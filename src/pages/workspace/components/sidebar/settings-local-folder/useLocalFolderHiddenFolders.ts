import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { toast } from "@/components/ui/sonner";
import { type SettingsLocalFolderBindings } from "./bindings";

export function useLocalFolderHiddenFolders({
  setLocalFolderHiddenFolders,
  hiddenFoldersRefreshNonceRef,
}: Pick<
  SettingsLocalFolderBindings,
  "setLocalFolderHiddenFolders" | "hiddenFoldersRefreshNonceRef"
>) {
  const handleHiddenFoldersChange = (folders: string[]) => {
    setLocalFolderHiddenFolders(folders);
    const refreshNonce = ++hiddenFoldersRefreshNonceRef.current;

    void (async () => {
      try {
        // 重扫会替换 workspace 页面集合；先把编辑器最新内容推进保存队列并等待本地写盘，
        // 避免用户刚编辑完就修改隐藏目录时丢失未落盘内容。
        window.dispatchEvent(
          new CustomEvent("goose-note:flush-editor", {
            detail: { immediate: true },
          }),
        );
        await usePages.getState().flushPendingLocalSaves();
        if (refreshNonce !== hiddenFoldersRefreshNonceRef.current) return;

        const pagesState = usePages.getState();
        const notebookState = useNotebooks.getState();
        const loadedWorkspaceIds = new Set(
          Object.values(pagesState.pages).map((page) => page.workspaceId),
        );
        Object.entries(notebookState.localFolderLoadStates).forEach(
          ([notebookId, state]) => {
            if (state.status === "ready") loadedWorkspaceIds.add(notebookId);
          },
        );
        if (notebookState.activeNotebookId) {
          loadedWorkspaceIds.add(notebookState.activeNotebookId);
        }

        let skippedDirtyNotebook = false;
        for (const notebookId of loadedWorkspaceIds) {
          const notebook = notebookState.notebooks[notebookId];
          if (notebook?.source !== "local-folder" || !notebook.localPath)
            continue;

          const currentPages = usePages.getState();
          const hasDirtyPage = Object.entries(
            currentPages.dirtyLocalPageIds,
          ).some(
            ([pageId, dirty]) =>
              dirty && currentPages.pages[pageId]?.workspaceId === notebookId,
          );
          if (hasDirtyPage) {
            skippedDirtyNotebook = true;
            continue;
          }

          await currentPages.loadLocalFolderPages(
            notebook.id,
            notebook.localPath,
          );
        }

        if (skippedDirtyNotebook) {
          toast.warning("部分本地文件夹仍有未保存内容，已暂缓刷新隐藏目录");
        }
      } catch (error) {
        console.error("[settings] 刷新本地文件夹隐藏目录失败", error);
        toast.error("刷新隐藏目录失败", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  };

  return { handleHiddenFoldersChange };
}
