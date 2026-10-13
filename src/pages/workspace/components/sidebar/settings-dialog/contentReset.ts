import { useNotebooks } from "@/stores/useNotebooks";
import { clearLocalPageMetadataCache, usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import {
  clearPersistedInternalPages,
  clearPersistedPages,
} from "@/lib/storage/pageRepository";
import { clearLegacyStorage } from "@/lib/storage/migrateLegacyStorage";
import { historyRepository } from "@/lib/history/repository";
import { clearAllLocalMdSnapshots } from "@/lib/local-md-snapshot";
import { removeLocalPageIdMap } from "@/lib/local-page-idmap";
import { localStorageAdapter as dataStorage } from "@/lib/storage";

export const clearCurrentContent = async (options?: {
  preserveLocalFolders?: boolean;
  preserveWorkspaceState?: boolean;
}) => {
  const preserveLocalFolders = options?.preserveLocalFolders ?? false;
  const preserveWorkspaceState = options?.preserveWorkspaceState ?? false;
  const currentNotebooks = useNotebooks.getState().notebooks;
  const localNotebooks = preserveLocalFolders
    ? Object.fromEntries(
        Object.entries(currentNotebooks).filter(
          ([, notebook]) => notebook.source === "local-folder",
        ),
      )
    : {};
  const localNotebookIds = new Set(Object.keys(localNotebooks));
  const allLocalNotebookIds = Object.values(currentNotebooks)
    .filter((notebook) => notebook.source === "local-folder")
    .map((notebook) => notebook.id);
  const localPages = preserveLocalFolders
    ? Object.fromEntries(
        Object.entries(usePages.getState().pages).filter(([, page]) =>
          localNotebookIds.has(page.workspaceId),
        ),
      )
    : {};

  // 本地文件夹内容属于用户磁盘数据，先落盘但绝不删除磁盘文件或 .goose/history。
  await usePages.getState().flushPendingLocalSaves();
  dataStorage.removeItem("goose-note-notebooks");
  historyRepository.clearAll();
  if (preserveLocalFolders) {
    clearPersistedInternalPages();
  } else {
    clearPersistedPages();
    allLocalNotebookIds.forEach(removeLocalPageIdMap);
    clearAllLocalMdSnapshots();
  }
  clearLegacyStorage();
  clearLocalPageMetadataCache();
  if (!preserveWorkspaceState) {
    useNotebookAiChats.getState().clearAllChats();
    useTabs.getState().clearAllTabs();
    window.localStorage.removeItem("goose-note-ai-panel-open");
  }
  useNotebooks.setState({
    notebooks: localNotebooks,
    activeNotebookId: null,
    lastActivePageByNotebook: {},
    localFolderLoadStates: {},
  });
  usePages.setState({
    pages: localPages,
    activePageId: null,
    pendingNavigatePageId: null,
    expandPageId: null,
    searchHighlightQuery: null,
    searchHighlightPageId: null,
    searchHighlightNonce: 0,
    handledSearchHighlightNonce: 0,
    hydrated: true,
    lastSavedAt: null,
    onboardingCompleted: false,
    dirtyLocalPageIds: {},
  });
};

export const createRollbackBackup = async (): Promise<Blob | null> => {
  const notebookState = useNotebooks.getState().notebooks;
  const notebookIds = Object.values(notebookState)
    .filter((notebook) => notebook.source !== "local-folder")
    .map((notebook) => notebook.id);
  if (notebookIds.length === 0) return null;
  const { generateExportZip } = await import("@/lib/export");
  return generateExportZip(
    { format: "md", notebookIds },
    notebookState,
    Object.values(usePages.getState().pages),
  );
};
