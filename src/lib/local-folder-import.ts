import type { JSONContent } from "@/types";
import { usePages } from "@/stores/usePages";
import { resolveLocalFolderImportParentId } from "@/lib/local-folder-target";
import { getLocalFolderFileDropTarget } from "@/lib/local-folder-file-drop-target";

export function isSupportedTextImportFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "markdown" || ext === "txt";
}

export async function importTextFilesToLocalFolder(options: {
  workspaceId: string;
  files: File[];
  parentId?: string;
}): Promise<{ importedIds: string[]; failedCount: number }> {
  const { workspaceId, files, parentId } = options;
  const importedIds: string[] = [];
  let failedCount = 0;
  // 导出/序列化管线（unified、katex 等）较重，拖拽导入时再加载，不进首屏。
  const { importFromMarkdown } = await import("@/lib/export");

  for (const file of files) {
    try {
      const text = await file.text();
      const filename = file.name.replace(/\.[^/.]+$/, "");
      const result = importFromMarkdown(text, filename, {
        preserveStructure: true,
      });
      if (!result.success) {
        failedCount += 1;
        continue;
      }

      const pageId = await usePages.getState().createLocalPageRecord({
        workspaceId,
        parentId,
        title: result.title || filename,
        content: result.content as JSONContent,
      });
      if (!pageId) {
        failedCount += 1;
        continue;
      }
      importedIds.push(pageId);
    } catch {
      failedCount += 1;
    }
  }

  return { importedIds, failedCount };
}

export function resolveImportParentForDrop(workspaceId: string): string | undefined {
  return resolveLocalFolderImportParentId(
    workspaceId,
    getLocalFolderFileDropTarget(),
  );
}
