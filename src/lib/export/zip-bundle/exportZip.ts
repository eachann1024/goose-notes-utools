import type { Page } from "@/types";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type JSZipNs from "jszip";
import { cloneExportBlocks } from "../prepareExportBlocks";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { createEmptyBlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { buildExportMarkdown, buildExportHtmlBody } from "../pageMarkdown";
import { renderExportHtml } from "../exportHtmlDocument";
import { extractImagesFromContent } from "./assets";
import { sanitizeFileName } from "./paths";
import { downloadBlob } from "./download";
import type { ExportOptions } from "./types";

function normalizeExportContent(
  content: Page["content"],
  isLocalFolderPage = false,
): BlockNoteContent {
  try {
    return cloneExportBlocks(content, { ensureFirstTitle: !isLocalFolderPage });
  } catch (error) {
    console.warn("[export] normalize page content failed:", error);
    return createEmptyBlockNoteContent();
  }
}

function getPageDepth(page: Page, pageMap: Map<string, Page>): number {
  let depth = 0;
  let parentId = page.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = pageMap.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

export async function generateExportZip(
  options: ExportOptions,
  notebooksMap: Record<string, { name: string; localPath?: string }>,
  allPages: Page[],
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const { format, notebookIds } = options;
  const exportMetadataPages: Page[] = [];

  for (const notebookId of notebookIds) {
    const notebook = notebooksMap[notebookId];
    if (!notebook) continue;

    const notebookFolderName = sanitizeFileName(notebook.name);
    const notebookFolder = zip.folder(notebookFolderName);
    if (!notebookFolder) continue;

    // assets 放在每个笔记本文件夹内部，而非 zip 根目录
    const assetsFolder = notebookFolder.folder("assets");
    if (!assetsFolder) continue;

    // 每个笔记本独立的 imageMap，避免跨笔记本冲突
    const imageMap = new Map<string, string>();
    const usedAssetNames = new Set<string>();

    const notebookPages = allPages.filter(
      (p) => p.workspaceId === notebookId && !p.trashedAt,
    );
    const notebookMetadataPages = allPages.filter(
      (p) => p.workspaceId === notebookId,
    );

    const pageMap = new Map<string, Page>();
    notebookMetadataPages.forEach((p) => pageMap.set(p.id, p));
    const visiblePageMap = new Map<string, Page>();
    notebookPages.forEach((p) => visiblePageMap.set(p.id, p));

    const notebookPath = notebook.localPath;
    const processedPages = new Map<string, Page>();

    for (const page of notebookMetadataPages) {
      const pageClone = structuredClone(page) as Page;
      pageClone.content = normalizeExportContent(pageClone.content, Boolean(page.localFilePath));
      await extractImagesFromContent(
        pageClone.content,
        assetsFolder,
        imageMap,
        usedAssetNames,
        getPageDepth(page, visiblePageMap),
        notebookPath,
        page.localFilePath,
      );
      processedPages.set(page.id, pageClone);
      exportMetadataPages.push(pageClone);
    }

    const processPage = async (page: Page, parentFolder: JSZipNs) => {
      const pageClone = processedPages.get(page.id) ?? page;

      let content = "";
      let extension = "";

      switch (format) {
        case "md": {
          content = await buildExportMarkdown(pageClone, pageClone.content, {
            includeTitleHeading: false,
          });
          extension = ".md";
          break;
        }
        case "html": {
          const bodyHtml = await buildExportHtmlBody(
            pageClone,
            pageClone.content,
          );
          content = await renderExportHtml(getPageTitle(pageClone), bodyHtml, false);
          extension = ".html";
          break;
        }
      }

      const exportTitle = getPageTitle(pageClone) || "untitled";
      const fileName = sanitizeFileName(exportTitle) + extension;
      parentFolder.file(fileName, content);

      const children = notebookPages.filter((p) => p.parentId === page.id);
      if (children.length > 0) {
        const subFolderName = sanitizeFileName(
          getPageTitle(pageClone) || "untitled",
        );
        const subFolder = parentFolder.folder(subFolderName);
        if (subFolder) {
          for (const child of children) {
            await processPage(child, subFolder);
          }
        }
      }
    };

    const rootPages = notebookPages.filter(
      (p) => !p.parentId || !visiblePageMap.has(p.parentId),
    );

    for (const p of rootPages) {
      await processPage(p, notebookFolder);
    }
  }

  const exportNotebooksList = Object.keys(notebooksMap)
    .filter((id) => notebookIds.includes(id))
    .map((id) => {
      const nb = notebooksMap[id];
      return nb
        ? { id, name: nb.name, icon: (nb as any).icon || "BookOpen" }
        : null;
    })
    .filter(Boolean);

  const exportPagesList = allPages.filter((p) =>
    notebookIds.includes(p.workspaceId),
  );

  // 读取并打包历史记录数据
  const { resolveHistoryBackend } = await import("@/lib/history/backend");
  const exportHistory: Record<string, { index: any; versions: any[] }> = {};

  for (const page of exportPagesList) {
    try {
      const backend = resolveHistoryBackend(page.id);
      const index = await backend.loadIndex(page.id);
      if (index && index.versions && index.versions.length > 0) {
        const versions: any[] = [];
        for (const v of index.versions) {
          const version = await backend.loadVersion(page.id, v.versionId);
          if (version) {
            versions.push(version);
          }
        }
        exportHistory[page.id] = {
          index,
          versions,
        };
      }
    } catch (err) {
      console.error(`Failed to export history for page ${page.id}:`, err);
    }
  }

  zip.file(
    "backup-metadata.json",
    JSON.stringify(
      {
        version: 1,
        notebooks: exportNotebooksList,
        pages: exportMetadataPages,
        history: exportHistory,
      },
      null,
      2,
    ),
  );

  return await zip.generateAsync({ type: "blob" });
}

export async function exportNotebooks(
  options: ExportOptions,
  notebooksMap: Record<string, { name: string; localPath?: string }>,
  allPages: Page[],
) {
  const content = await generateExportZip(options, notebooksMap, allPages);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  await downloadBlob(content, `goose-note-export-${timestamp}.zip`);
}
