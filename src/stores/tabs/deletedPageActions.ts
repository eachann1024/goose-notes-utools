import { usePages } from "../usePages";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import type {
  TabsStoreContext,
  TabsActionHelpers,
  TabsState,
  TabItem,
} from "./types";
import {
  createTabId,
  getWorkspaceIdForPage,
  resolveTabIdInHistory,
  workspaceTabPageId,
} from "./queries";
import { isSpecialTab } from "./identity";

export function createDeletedPageActions({
  set,
  get,
  scheduleSetActivePage,
  syncHistoryWithOpenTabs,
}: TabsStoreContext &
  Pick<
    TabsActionHelpers,
    "scheduleSetActivePage" | "syncHistoryWithOpenTabs"
  >): Pick<TabsState, "removeDeletedPage"> {
  return {
    removeDeletedPage: (pageId: string) => {
      const { openTabs, activeTabId } = get();
      const deletedIndex = openTabs.findIndex((tab) => tab.pageId === pageId);
      const deletedPage = usePages.getState().getPage(pageId);
      const preferredPageId = usePages.getState().activePageId;
      const nextTabs = openTabs.filter((tab) => tab.pageId !== pageId);
      if (nextTabs.length === openTabs.length) return;

      let finalTabs = nextTabs;
      let nextActiveId = activeTabId;

      if (!nextActiveId || !nextTabs.some((tab) => tab.id === nextActiveId)) {
        if (preferredPageId) {
          const existingPreferredTab = nextTabs.find(
            (tab) => tab.pageId === preferredPageId,
          );

          if (existingPreferredTab) {
            nextActiveId = existingPreferredTab.id;
          } else {
            const insertionIndex =
              deletedIndex === -1
                ? nextTabs.length
                : Math.min(deletedIndex, nextTabs.length);
            const replacementTab: TabItem = {
              id: createTabId(preferredPageId),
              pageId: preferredPageId,
              workspaceId: getWorkspaceIdForPage(preferredPageId),
              lastAccessedAt: Date.now(),
            };
            finalTabs = [
              ...nextTabs.slice(0, insertionIndex),
              replacementTab,
              ...nextTabs.slice(insertionIndex),
            ];
            nextActiveId = replacementTab.id;
          }
        } else {
          nextActiveId =
            nextTabs[Math.min(deletedIndex, nextTabs.length - 1)]?.id ?? null;
        }
      }

      if (effectiveSingleTabMode() && finalTabs.length > 1) {
        const preferred = finalTabs.find((tab) => tab.id === nextActiveId);
        const onlyTab = preferred ?? finalTabs[finalTabs.length - 1];
        finalTabs = onlyTab ? [onlyTab] : [];
        nextActiveId = onlyTab?.id ?? null;
      }

      const historyState = syncHistoryWithOpenTabs(finalTabs);
      const fallbackActiveId =
        resolveTabIdInHistory(nextActiveId, finalTabs) ??
        (historyState.tabHistoryIndex >= 0
          ? historyState.tabHistory[historyState.tabHistoryIndex]
          : null);

      set({
        openTabs: finalTabs,
        activeTabId: fallbackActiveId,
        ...historyState,
      });

      const nextActiveTab = finalTabs.find(
        (tab) => tab.id === fallbackActiveId,
      );
      if (deletedPage?.trashedAt) {
        if (nextActiveTab && !isSpecialTab(nextActiveTab)) {
          const pageId = workspaceTabPageId(nextActiveTab);
          if (pageId !== preferredPageId) {
            get().syncNotebookForPage(pageId);
            void scheduleSetActivePage(pageId);
          }
        }
        return;
      }

      if (nextActiveTab && !isSpecialTab(nextActiveTab)) {
        const pageId = workspaceTabPageId(nextActiveTab);
        get().syncNotebookForPage(pageId);
        void scheduleSetActivePage(pageId);
      } else {
        get().syncNotebookForPage(null);
        void scheduleSetActivePage(null);
      }
    },
  };
}
