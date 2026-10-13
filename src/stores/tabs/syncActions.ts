import { usePages } from "../usePages";
import { useNotebooks } from "../useNotebooks";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import type { TabsStoreContext, TabsActionHelpers, TabsState } from "./types";
import {
  findTabByPageId,
  stampTabAccess,
  ensureSplitForWorkspaceTab,
  workspaceTabPageId,
} from "./queries";
import { isSpecialTab } from "./identity";
import { commitActiveEditor } from "./pageSaves";

export function createSyncActions({
  set,
  get,
  scheduleSetActivePage,
  pushTabHistory,
  replaceWithSinglePage,
  replaceWithSingleWelcome,
}: TabsStoreContext &
  Pick<
    TabsActionHelpers,
    | "scheduleSetActivePage"
    | "pushTabHistory"
    | "replaceWithSinglePage"
    | "replaceWithSingleWelcome"
  >): Pick<
  TabsState,
  | "syncNotebookForPage"
  | "syncActiveTabForPage"
  | "openTab"
  | "openInCurrentTab"
  | "syncTabPageId"
  | "setActiveTab"
> {
  return {
    syncNotebookForPage: (pageId: string | null) => {
      if (!pageId) return;
      const page = usePages.getState().getPage(pageId);
      if (!page) return;
      const notebookStore = useNotebooks.getState();
      if (notebookStore.activeNotebookId !== page.workspaceId) {
        notebookStore.setActiveNotebook(page.workspaceId);
      }
    },
    syncActiveTabForPage: (pageId: string | null) => {
      if (!pageId) return;
      if (effectiveSingleTabMode()) {
        void replaceWithSinglePage(pageId);
        return;
      }
      const { openTabs, activeTabId } = get();
      const existingTab = findTabByPageId(openTabs, pageId);
      if (existingTab) {
        if (existingTab.id !== activeTabId) {
          get().setActiveTab(existingTab.id);
        }
        return;
      }

      get().openPermanentTab(pageId);
    },
    openTab: (pageId: string) => {
      get().openPermanentTab(pageId);
    },
    openInCurrentTab: (pageId: string) => {
      get().openPreviewTab(pageId);
    },
    syncTabPageId: (tabId: string, pageId: string) => {
      const { openTabs } = get();
      const tab = openTabs.find((item) => item.id === tabId);
      if (!tab || isSpecialTab(tab) || tab.pageId === pageId) return;
      const page = usePages.getState().getPage(pageId);
      if (!page || page.isFolder || page.trashedAt) return;
      set({
        openTabs: openTabs.map((item) =>
          item.id === tabId
            ? { ...item, pageId, workspaceId: page.workspaceId }
            : item,
        ),
      });
    },
    setActiveTab: (tabId: string) => {
      const { openTabs, activeTabId } = get();
      const tab = openTabs.find((item) => item.id === tabId);
      if (!tab) return;
      if (effectiveSingleTabMode()) {
        if (tab.type === "welcome") {
          void replaceWithSingleWelcome();
        } else if (!isSpecialTab(tab)) {
          void replaceWithSinglePage(tab.pageId);
        }
        return;
      }
      if (tab.id !== activeTabId) commitActiveEditor();

      const now = Date.now();
      set({
        openTabs: openTabs.map((item) =>
          item.id === tab.id || item.id === activeTabId
            ? stampTabAccess(item, now)
            : item,
        ),
        activeTabId: tab.id,
      });
      ensureSplitForWorkspaceTab(tab);
      pushTabHistory(tab.id);
      // 欢迎 / AI 标签不关联真实页面，不同步活动页。
      if (tab.type === "welcome") return;
      if (tab.type === "notebook-ai") {
        const notebookId = tab.workspaceId;
        if (notebookId) {
          const notebookStore = useNotebooks.getState();
          if (notebookStore.activeNotebookId !== notebookId) {
            notebookStore.setActiveNotebook(notebookId);
          }
        }
        return;
      }
      get().syncNotebookForPage(workspaceTabPageId(tab));
      void scheduleSetActivePage(workspaceTabPageId(tab));
    },
  };
}
