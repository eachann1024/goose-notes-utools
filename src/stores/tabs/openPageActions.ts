import { usePages } from "../usePages";
import { useNotebooks } from "../useNotebooks";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { findLoneVisibleWorkspaceTab } from "@/pages/workspace/components/page/visibleTabs";
import { pageFileNavKey, useFileNavHistory } from "../useFileNavHistory";
import type {
  TabsStoreContext,
  TabsActionHelpers,
  TabsState,
  TabItem,
} from "./types";
import {
  findTabByPageId,
  focusTabLeafForPage,
  createTabId,
  getWorkspaceIdForPage,
  orderTabs,
  stampTabAccess,
  ensureSplitForWorkspaceTab,
} from "./queries";
import { commitActiveEditor } from "./pageSaves";

export function createOpenPageActions({
  set,
  get,
  scheduleSetActivePage,
  syncHistoryWithOpenTabs,
  pushTabHistory,
  replaceWithSinglePage,
}: TabsStoreContext &
  Pick<
    TabsActionHelpers,
    | "scheduleSetActivePage"
    | "syncHistoryWithOpenTabs"
    | "pushTabHistory"
    | "replaceWithSinglePage"
  >): Pick<
  TabsState,
  "openPermanentTab" | "openPreviewTab" | "promotePreviewTab"
> {
  return {
    openPermanentTab: (pageId: string, options?: { pin?: boolean }) => {
      if (effectiveSingleTabMode()) {
        void replaceWithSinglePage(pageId);
        return;
      }
      const { openTabs, activeTabId } = get();
      const existingTab = findTabByPageId(openTabs, pageId);
      if (existingTab) {
        if (existingTab.id !== activeTabId) commitActiveEditor();
        if (existingTab.preview) {
          get().promotePreviewTab(existingTab.id);
        }
        if (options?.pin && !existingTab.pinned) {
          get().togglePinTab(existingTab.id);
        }
        focusTabLeafForPage(existingTab.id, pageId);
        get().setActiveTab(existingTab.id);
        return;
      }

      commitActiveEditor();
      const now = Date.now();
      const newTab: TabItem = {
        id: createTabId(pageId),
        pageId,
        workspaceId: getWorkspaceIdForPage(pageId),
        pinned: options?.pin ? true : undefined,
        preview: false,
        lastAccessedAt: now,
      };
      const nextOpenTabs = orderTabs([
        ...openTabs.map((tab) =>
          tab.id === activeTabId ? stampTabAccess(tab, now) : tab,
        ),
        newTab,
      ]);
      set({
        openTabs: nextOpenTabs,
        activeTabId: newTab.id,
      });
      ensureSplitForWorkspaceTab(newTab);
      pushTabHistory(newTab.id);
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
    },
    openPreviewTab: (pageId: string) => {
      if (effectiveSingleTabMode()) {
        void replaceWithSinglePage(pageId);
        return;
      }
      const { openTabs, activeTabId } = get();

      const existingTab = findTabByPageId(openTabs, pageId);
      if (existingTab) {
        if (existingTab.id !== activeTabId) commitActiveEditor();
        focusTabLeafForPage(existingTab.id, pageId);
        get().setActiveTab(existingTab.id);
        return;
      }

      const targetPage = usePages.getState().getPage(pageId);
      const loneTab = findLoneVisibleWorkspaceTab(
        openTabs,
        (id) => usePages.getState().getPage(id),
        targetPage?.workspaceId ?? useNotebooks.getState().activeNotebookId,
      );
      if (loneTab) {
        commitActiveEditor();
        const now = Date.now();
        const nextTab: TabItem = {
          id: loneTab.id,
          pageId,
          workspaceId: getWorkspaceIdForPage(pageId),
          pinned: loneTab.pinned,
          preview: false,
          lastAccessedAt: now,
        };
        set({
          openTabs: openTabs.map((tab) =>
            tab.id === loneTab.id ? nextTab : tab,
          ),
          activeTabId: nextTab.id,
        });
        ensureSplitForWorkspaceTab(nextTab);
        useFileNavHistory.getState().push(pageFileNavKey(pageId));
        get().syncNotebookForPage(pageId);
        void scheduleSetActivePage(pageId);
        return;
      }

      commitActiveEditor();
      const workspaceId = getWorkspaceIdForPage(pageId);

      // VSCode 式预览标签：同时只保留一个预览标签，但它始终在最右新建，
      // 不复用某个固定位置的旧槽。打开新预览时，丢弃上一个未晋升的预览标签 + 占位的欢迎标签。
      const now = Date.now();
      const newTab: TabItem = {
        id: createTabId(pageId),
        pageId,
        workspaceId,
        preview: true,
        lastAccessedAt: now,
      };
      const survivingTabs = openTabs.filter(
        (tab) => !tab.preview && tab.type !== "welcome",
      );
      const nextOpenTabs = orderTabs([
        ...survivingTabs.map((tab) =>
          tab.id === activeTabId ? stampTabAccess(tab, now) : tab,
        ),
        newTab,
      ]);
      set({
        openTabs: nextOpenTabs,
        ...syncHistoryWithOpenTabs(nextOpenTabs),
        activeTabId: newTab.id,
      });
      ensureSplitForWorkspaceTab(newTab);
      pushTabHistory(newTab.id);
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
    },
    promotePreviewTab: (tabId?: string) => {
      const { openTabs, activeTabId } = get();
      const targetId = tabId ?? activeTabId;
      if (!targetId) return;
      const target = openTabs.find((tab) => tab.id === targetId);
      if (!target?.preview) return;
      const nextTabs = orderTabs(
        openTabs.map((tab) =>
          tab.id === targetId ? { ...tab, preview: false } : tab,
        ),
      );
      set({ openTabs: nextTabs });
    },
  };
}
