import { toast } from "@/components/ui/sonner";
import { describeDiskWriteError } from "@/lib/diskWriteError";
import { usePages } from "../usePages";
import { getPageTitle } from "@/components/editor/utils/page-title";
import type { TabsPageSaveState, TabsActionHelpers } from "./types";

// 提交当前编辑器内容（切换/关闭标签前调用），确保未防抖落盘的编辑不丢。
export const commitActiveEditor = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", { detail: { immediate: true } }),
  );
};

// 对被关闭的页面执行 flush，完成后若仍 dirty（写盘失败）则 toast 警告一次。
// 冲突场景下 write.ts 会 dispatch goose-note:local-file-conflict，
// useLocalFolderWatch 已有 showConflictToast 处理，此处统一 toast 也可接受（不删冲突 UX）。
export const flushClosedPageSaves = (pageIds: string[]): void => {
  if (pageIds.length === 0) return;
  const pagesStore = usePages.getState();
  void Promise.all(
    pageIds.map(async (pageId) => {
      let flushError: unknown;
      try {
        await pagesStore.flushPendingLocalSaveByPageId(pageId);
      } catch (error) {
        flushError = error;
        console.error("[tabs] closed page flush failed", pageId, error);
      }
      const stillDirty = usePages.getState().dirtyLocalPageIds[pageId];
      if (stillDirty) {
        const page = usePages.getState().getPage(pageId);
        const title = page ? getPageTitle(page) : pageId;
        toast.warning(`「${title}」未能保存到磁盘`, {
          description: describeDiskWriteError(
            flushError ?? new Error(`本地页面保存未完成：${pageId}`),
          ),
        });
      }
    }),
  ).catch((error) => {
    // 单页错误已在任务内消费；这里仅兜底，避免关闭标签时产生未处理拒绝。
    console.error("[tabs] closed pages flush failed", error);
  });
};

export function createPageSaveHelpers(
  state: TabsPageSaveState,
): Pick<TabsActionHelpers, "scheduleSetActivePage"> {
  const scheduleSetActivePage = (pageId: string | null) => {
    state.setActivePageChain = state.setActivePageChain
      .catch(() => {})
      .then(() => usePages.getState().setActivePage(pageId));
    return state.setActivePageChain;
  };
  return { scheduleSetActivePage };
}
