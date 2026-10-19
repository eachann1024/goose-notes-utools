import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { landingPageId } from "@/stores/pages/sidebarCatalog";
import type { Page } from "@/types";

const isActiveNotebookPage = (page: Page | undefined, notebookId: string) =>
  !!page && page.workspaceId === notebookId && !page.trashedAt;

export function resolveNotebookLandingPageId(
  notebookId: string | null | undefined,
): string | null {
  if (!notebookId) return null;

  const notebooksStore = useNotebooks.getState();
  const notebook = notebooksStore.notebooks[notebookId];
  if (!notebook || notebook.source === "local-folder") return null;

  const pages = usePages.getState().pages;
  const lastPageId = notebooksStore.getLastActivePage(notebookId);
  const lastPage = lastPageId ? pages[lastPageId] : undefined;
  if (lastPageId && isActiveNotebookPage(lastPage, notebookId)) {
    return lastPageId;
  }

  return landingPageId(notebookId, pages);
}

export async function activateNotebook(
  notebookId: string,
): Promise<string | null> {
  const notebooksStore = useNotebooks.getState();
  if (!notebooksStore.notebooks[notebookId]) return null;

  notebooksStore.setActiveNotebook(notebookId);
  const landingPageId = resolveNotebookLandingPageId(notebookId);
  await usePages.getState().setActivePage(landingPageId);
  useTabs.getState().syncActiveTabForPage(landingPageId);
  return landingPageId;
}
