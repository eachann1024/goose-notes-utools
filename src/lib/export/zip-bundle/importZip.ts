import type { Page } from "@/types";
import type JSZipNs from "jszip";
import { importFromMarkdown } from "../markdown/parse";
import type { ImportResult } from "../markdown/parse";
import { mimeTypeFromAssetPath, getBundledAssetName, sanitizeFileName } from "./paths";

export async function importNotebooksFromZip(
  zipBlob: Blob,
  onCreateNotebook: (name: string, icon?: string, id?: string) => string,
  onCreatePage: (
    data: Partial<Page>,
    workspaceId: string,
    parentId?: string,
    id?: string,
  ) => string | Promise<string>,
) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(zipBlob);

  // 收集所有 assets：既查根级 assets/（旧格式），也查各笔记本内 xxx/assets/（新格式）
  const loadAssetsFromFolder = async (
    folder: JSZipNs | null,
  ): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    if (!folder) return map;
    const files: string[] = [];
    folder.forEach((relativePath) => files.push(relativePath));
    for (const p of files) {
      const file = folder.file(p);
      if (file) {
        const base64 = await file.async("base64");
        const mimeType = mimeTypeFromAssetPath(p);
        map.set(p, `data:${mimeType};base64,${base64}`);
      }
    }
    return map;
  };

  // 根级 assets（旧导出格式兼容）
  const rootAssetMap = await loadAssetsFromFolder(zip.folder("assets"));

  const restoreBundledAssets = (
    blocks: any[],
    notebookAssetMap: Map<string, string>,
  ) => {
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      if (
        (block.type === "image" ||
          block.type === "imageResize" ||
          block.type === "file" ||
          block.type === "audio" ||
          block.type === "video") &&
        block.props?.url
      ) {
        const src = block.props.url as string;
        const filename = getBundledAssetName(src);
        if (filename) {
          // 优先从笔记本内 assets 查找，再从根级 assets 查找
          const dataUrl =
            notebookAssetMap.get(filename) || rootAssetMap.get(filename);
          if (dataUrl) {
            block.props.url = dataUrl;
          }
        }
      }
      if (block.children?.length)
        restoreBundledAssets(block.children, notebookAssetMap);
    }
  };

  const metaFile = zip.file("backup-metadata.json");
  if (metaFile) {
    let meta: any;
    try {
      const metaText = await metaFile.async("text");
      meta = JSON.parse(metaText);
    } catch (error) {
      throw new Error("备份元数据已损坏，已停止导入", { cause: error });
    }

    if (!meta || !Array.isArray(meta.notebooks) || !Array.isArray(meta.pages)) {
      throw new Error("备份元数据格式无效，已停止导入");
    }

    // 在产生任何 store 副作用前先把资源完整读入内存。此后若创建回调失败，
    // 异常必须向外传播给 SettingsDialog 的回滚流程，禁止再回退目录解析造成重复数据。
    const notebookAssetMaps = new Map<string, Map<string, string>>();
    for (const nb of meta.notebooks) {
      const assetMap = await loadAssetsFromFolder(
        zip.folder(`${sanitizeFileName(nb.name)}/assets`),
      );
      notebookAssetMaps.set(nb.id, assetMap);
    }

    for (const nb of meta.notebooks) {
      onCreateNotebook(nb.name, nb.icon || "BookOpen", nb.id);
    }

    const importedPageIdMap = new Map<string, string>();

    for (const page of meta.pages) {
      const pageData = { ...page };
      const sourcePageId = typeof page.id === "string" ? page.id : null;
      delete (pageData as any).localFilePath;
      const assetMap = notebookAssetMaps.get(page.workspaceId);
      if (pageData.content && assetMap) {
        restoreBundledAssets(pageData.content, assetMap);
      }
      const createdPageId = await onCreatePage(
        pageData,
        page.workspaceId,
        page.parentId,
        page.id,
      );
      if (sourcePageId) {
        importedPageIdMap.set(sourcePageId, createdPageId);
      }
    }

    // 还原并合并历史记录数据到本地数据库
    if (meta.history) {
      const { resolveHistoryBackend } = await import("@/lib/history/backend");
      const { selectEvictedVersionIds } = await import(
        "@/lib/history/retention"
      );

      for (const [sourcePageId, historyItem] of Object.entries(
        meta.history,
      ) as [string, any][]) {
        try {
          const pageId = importedPageIdMap.get(sourcePageId) ?? sourcePageId;
          const backend = resolveHistoryBackend(pageId);
          const localIndex = await backend.loadIndex(pageId);
          const importedIndex = historyItem.index;
          const importedVersions = historyItem.versions || [];

          if (!importedIndex) continue;

          // 1. 合并 versions 列表并去重
          const versionMap = new Map<string, any>();

          if (localIndex && Array.isArray(localIndex.versions)) {
            for (const v of localIndex.versions) {
              versionMap.set(v.versionId, v);
            }
          }
          if (Array.isArray(importedIndex.versions)) {
            for (const v of importedIndex.versions) {
              versionMap.set(v.versionId, v);
            }
          }

          // 按时间戳从小到大排序
          let mergedVersions = Array.from(versionMap.values()).sort(
            (a, b) => a.createdAt - b.createdAt,
          );

          // 2. 超出数量限制裁剪（淘汰最旧的非 Milestone）
          const evictedVersionIds = selectEvictedVersionIds(mergedVersions);
          if (evictedVersionIds.length > 0) {
            const evictedSet = new Set(evictedVersionIds);
            mergedVersions = mergedVersions.filter(
              (v) => !evictedSet.has(v.versionId),
            );
          }

          // 3. 计算最新的字符数
          const lastVersionCharCount =
            mergedVersions.length > 0
              ? mergedVersions[mergedVersions.length - 1].charCount
              : 0;

          // 4. 保存合并后的索引
          await backend.saveIndex({
            pageId,
            versions: mergedVersions,
            lastVersionCharCount,
          });

          // 5. 写入导入的历史版本
          if (Array.isArray(importedVersions)) {
            const activeVersionIds = new Set(
              mergedVersions.map((v) => v.versionId),
            );
            for (const version of importedVersions) {
              if (activeVersionIds.has(version.versionId)) {
                await backend.saveVersion({ ...version, pageId });
              }
            }
          }

          // 6. 清理淘汰裁剪掉的本地历史版本
          for (const evictedId of evictedVersionIds) {
            await backend.removeVersion(pageId, evictedId);
          }
        } catch (err) {
          console.error(
            `Failed to restore and merge history for page ${sourcePageId}:`,
            err,
          );
        }
      }
    }

    return;
  }

  const topLevelEntries = new Set<string>();
  zip.forEach((path) => {
    const parts = path.split("/");
    if (parts.length > 1 && parts[0] !== "assets") {
      topLevelEntries.add(parts[0]);
    }
  });

  for (const notebookName of topLevelEntries) {
    const workspaceId = onCreateNotebook(notebookName);
    const notebookPathPrefix = `${notebookName}/`;
    const pathIdMap = new Map<string, string>();

    // 加载笔记本内的 assets（新格式）
    const notebookAssetMap = await loadAssetsFromFolder(
      zip.folder(`${notebookName}/assets`),
    );

    const files: { path: string; depth: number }[] = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && path.startsWith(notebookPathPrefix)) {
        const relativePath = path.slice(notebookPathPrefix.length);
        // 跳过 assets 目录下的文件（图片，不是页面）
        if (relativePath.startsWith("assets/")) return;
        files.push({
          path: relativePath,
          depth: relativePath.split("/").length,
        });
      }
    });
    files.sort((a, b) => a.depth - b.depth);

    for (const { path: relativePath } of files) {
      const file = zip.file(`${notebookPathPrefix}${relativePath}`);
      if (!file) continue;

      const extension = relativePath.split(".").pop()?.toLowerCase();
      const nameWithoutExt = relativePath.replace(/\.[^/.]+$/, "");
      const pathParts = nameWithoutExt.split("/");
      const title = pathParts[pathParts.length - 1];

      let parentId: string | undefined;
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join("/");
        parentId = pathIdMap.get(parentPath);
      }

      let pageData: Partial<Page> = {};

      if (extension === "json") {
        const text = await file.async("text");
        try {
          const imported = JSON.parse(text) as Page;
          pageData = { ...imported };
          delete (pageData as any).id;
          delete (pageData as any).workspaceId;
          delete (pageData as any).parentId;
          if (pageData.content)
            restoreBundledAssets(pageData.content, notebookAssetMap);
        } catch (e) {
          console.error("Failed to parse JSON page", e);
        }
      } else if (extension === "md") {
        const text = await file.async("text");
        const imported: ImportResult = importFromMarkdown(text, title);
        const content = imported.content;
        const firstBlock = Array.isArray(content) ? content[0] : undefined;
        const hasH1Title =
          firstBlock?.type === "heading" && firstBlock.props?.level === 1;
        if (!hasH1Title) {
          const blocks = Array.isArray(content) ? content : [];
          pageData = {
            content: [
              { type: "heading", props: { level: 1 }, content: imported.title },
              ...blocks,
            ],
          };
        } else {
          pageData = { content };
        }
        if (pageData.content)
          restoreBundledAssets(pageData.content, notebookAssetMap);
      }

      const newId = await onCreatePage(pageData, workspaceId, parentId);
      pathIdMap.set(nameWithoutExt, newId);
    }
  }
}
