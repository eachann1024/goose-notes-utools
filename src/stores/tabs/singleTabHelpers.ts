import { toast } from "@/components/ui/sonner";
import { describeDiskWriteError } from "@/lib/diskWriteError";
import { usePages } from "../usePages";
import {
  FILE_NAV_WELCOME,
  pageFileNavKey,
  useFileNavHistory,
} from "../useFileNavHistory";
import type { TabsStoreContext, TabsActionHelpers, TabItem } from "./types";
import { commitActiveEditor } from "./pageSaves";
import { isSpecialTab, WELCOME_TAB_PAGE_ID } from "./identity";
import {
  createTabId,
  getWorkspaceIdForPage,
  ensureSplitForWorkspaceTab,
} from "./queries";

export function createSingleTabHelpers({
  set,
  get,
  scheduleSetActivePage,
  switchToken,
}: TabsStoreContext &
  Pick<TabsActionHelpers, "scheduleSetActivePage"> & {
    switchToken: { current: number };
  }): Pick<
  TabsActionHelpers,
  "replaceWithSinglePage" | "replaceWithSingleWelcome"
> {
  const replaceWithSinglePage = async (pageId: string) => {
    const targetPage = usePages.getState().getPage(pageId);
    if (!targetPage || targetPage.trashedAt) return;

    const { openTabs, activeTabId } = get();
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    if (activeTab?.pageId === pageId) {
      if (openTabs.length > 1) {
        set({
          openTabs: [activeTab],
          activeTabId: activeTab.id,
          tabHistory: [activeTab.id],
          tabHistoryIndex: 0,
          isHistoryNavigating: false,
        });
      }
      useFileNavHistory.getState().push(pageFileNavKey(pageId));
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
      return;
    }

    const token = ++switchToken.current;
    commitActiveEditor();

    const currentPageId =
      activeTab && !isSpecialTab(activeTab) ? activeTab.pageId : null;
    if (currentPageId) {
      try {
        await usePages.getState().flushPendingLocalSaveByPageId(currentPageId);
      } catch (error) {
        toast.error("当前笔记保存失败，未切换", {
          description: describeDiskWriteError(error),
        });
        return;
      }
      if (token !== switchToken.current) return;
      if (usePages.getState().dirtyLocalPageIds[currentPageId]) {
        const currentPage = usePages.getState().getPage(currentPageId);
        toast.error("当前笔记保存失败，未切换", {
          description: currentPage
            ? describeDiskWriteError(
                new Error(`本地页面保存未完成：${currentPageId}`),
              )
            : "请先处理当前文件的保存状态。",
        });
        return;
      }
    }

    if (token !== switchToken.current) return;
    const now = Date.now();
    const newTab: TabItem = {
      id: createTabId(pageId),
      pageId,
      workspaceId: getWorkspaceIdForPage(pageId),
      preview: false,
      lastAccessedAt: now,
    };
    set({
      openTabs: [newTab],
      activeTabId: newTab.id,
      tabHistory: [newTab.id],
      tabHistoryIndex: 0,
      isHistoryNavigating: false,
    });
    ensureSplitForWorkspaceTab(newTab);
    useFileNavHistory.getState().push(pageFileNavKey(pageId));
    get().syncNotebookForPage(pageId);
    await scheduleSetActivePage(pageId);
  };

  const replaceWithSingleWelcome = async () => {
    const { openTabs, activeTabId } = get();
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    if (activeTab?.type === "welcome" && openTabs.length === 1) return;

    const token = ++switchToken.current;
    commitActiveEditor();
    const currentPageId =
      activeTab && !isSpecialTab(activeTab) ? activeTab.pageId : null;
    if (currentPageId) {
      try {
        await usePages.getState().flushPendingLocalSaveByPageId(currentPageId);
      } catch (error) {
        toast.error("当前笔记保存失败，未切换", {
          description: describeDiskWriteError(error),
        });
        return;
      }
      if (token !== switchToken.current) return;
      if (usePages.getState().dirtyLocalPageIds[currentPageId]) {
        toast.error("当前笔记保存失败，未切换", {
          description: describeDiskWriteError(
            new Error(`本地页面保存未完成：${currentPageId}`),
          ),
        });
        return;
      }
    }

    const welcomeTab: TabItem = {
      id: createTabId(WELCOME_TAB_PAGE_ID),
      pageId: WELCOME_TAB_PAGE_ID,
      type: "welcome",
      lastAccessedAt: Date.now(),
    };
    set({
      openTabs: [welcomeTab],
      activeTabId: welcomeTab.id,
      tabHistory: [welcomeTab.id],
      tabHistoryIndex: 0,
      isHistoryNavigating: false,
    });
    useFileNavHistory.getState().push(FILE_NAV_WELCOME);
    await scheduleSetActivePage(null);
  };
  return { replaceWithSinglePage, replaceWithSingleWelcome };
}
