import type { Page } from "@/types";
import type { Notebook } from "@/stores/useNotebooks";
import type { AiFileReferenceSourceType } from "./types";

export function getSourceType(page: Page): AiFileReferenceSourceType {
  return page.localFilePath ? "local-file" : "app-page";
}

export function getNotebookSnapshot(
  workspaceId: string,
  notebooks: Record<string, Notebook>,
) {
  return notebooks[workspaceId];
}

export function getLocationSnapshot(page: Page, notebooks: Record<string, Notebook>) {
  const notebook = getNotebookSnapshot(page.workspaceId, notebooks);
  if (!page.localFilePath) return notebook?.name ?? "未知笔记本";

  const basePath = notebook?.localPath?.replace(/[\\/]+$/, "") ?? "";
  const normalizedPath = page.localFilePath.replace(/[\\/]+/g, "/");
  const normalizedBase = basePath.replace(/[\\/]+/g, "/");

  if (normalizedBase && normalizedPath.startsWith(normalizedBase)) {
    const relativePath = normalizedPath
      .slice(normalizedBase.length)
      .replace(/^\/+/, "");
    return relativePath || normalizedPath;
  }

  return normalizedPath;
}
