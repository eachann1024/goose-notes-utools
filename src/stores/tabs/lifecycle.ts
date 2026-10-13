import { usePages } from "../usePages";
import {
  FALLBACK_WINDOW_ID,
  resolveWindowContext,
  tabsPersistKey,
  type GooseWindowInitPayload,
  type GooseWindowTabSnapshot,
} from "@/lib/electron/windowContext";
import { applyPersistedTabSplit } from "../useEditorSplit";
import type {
  TabsLifecycleStore,
  TabsPersistenceState,
  TabsPersistenceHelpers,
  TabItem,
} from "./types";
import {
  ensureSplitForWorkspaceTab,
  syncEditorSplitsToOpenTabs,
} from "./queries";

export function registerTabsLifecycle(
  store: TabsLifecycleStore,
  state: TabsPersistenceState,
  { readPersistedTabsRaw, persistTabs }: TabsPersistenceHelpers,
): void {
  // 标签状态变化时持久化（跨会话恢复上次打开的标签）。
  if (typeof window !== "undefined") {
    const applyTabSnapshots = (
      tabs: GooseWindowTabSnapshot[],
      activeId?: string,
    ) => {
      const now = Date.now();
      const openTabs: TabItem[] = tabs.map((tab) => ({
        id: tab.id,
        pageId: tab.pageId,
        type: tab.type as TabItem["type"],
        pinned: tab.pinned,
        workspaceId: tab.workspaceId,
        lastAccessedAt: now,
      }));
      const activeTabId = activeId ?? openTabs[0]?.id ?? null;
      store.setState({ openTabs, activeTabId });
      const active =
        openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0];
      if (!active) return;
      ensureSplitForWorkspaceTab(active);
      if (active.type === "welcome") {
        void usePages.getState().setActivePage(null);
        return;
      }
      store.getState().syncNotebookForPage(active.pageId);
      void usePages.getState().setActivePage(active.pageId);
    };

    let appliedTakeTab = false;
    let pendingRestoredTabs: GooseWindowTabSnapshot[] | null = null;

    const applyWindowInit = (payload: GooseWindowInitPayload) => {
      if (payload.takeTab) {
        appliedTakeTab = true;
        pendingRestoredTabs = null;
        applyTabSnapshots([payload.takeTab], payload.takeTab.id);
        applyPersistedTabSplit(payload.takeTab.id, state.tabsWindowId);
        persistTabs(store.getState());
        return;
      }
      if (payload.restoredTabs && payload.restoredTabs.length > 0) {
        if (appliedTakeTab) return;
        if (!state.persistReady) {
          pendingRestoredTabs = payload.restoredTabs;
          return;
        }
        const dest = readPersistedTabsRaw(tabsPersistKey(state.tabsWindowId));
        if (dest?.openTabs.length) return;
        applyTabSnapshots(payload.restoredTabs);
        persistTabs(store.getState());
      }
    };

    window.gooseDesktop?.onWindowInit?.(applyWindowInit);

    store.subscribe((state) => persistTabs(state));
    store.subscribe((state, prev) => {
      if (
        state.openTabs === prev.openTabs &&
        state.activeTabId === prev.activeTabId
      ) {
        return;
      }
      syncEditorSplitsToOpenTabs(state.openTabs, state.activeTabId);
    });
    syncEditorSplitsToOpenTabs(
      store.getState().openTabs,
      store.getState().activeTabId,
    );
    void resolveWindowContext().then((ctx) => {
      state.persistReady = true;
      const prevId = state.tabsWindowId;
      state.tabsWindowId = ctx.windowId;
      if (appliedTakeTab) {
        persistTabs(store.getState());
        const takeId = store.getState().activeTabId;
        if (takeId) applyPersistedTabSplit(takeId, ctx.windowId);
        return;
      }
      const dest = readPersistedTabsRaw(tabsPersistKey(ctx.windowId));
      if (dest) {
        store.setState({
          openTabs: dest.openTabs,
          activeTabId: dest.activeTabId,
          recentlyClosedPageIds: dest.recentlyClosedPageIds,
        });
        pendingRestoredTabs = null;
        return;
      }
      if (pendingRestoredTabs && pendingRestoredTabs.length > 0) {
        applyTabSnapshots(pendingRestoredTabs);
        pendingRestoredTabs = null;
      }
      persistTabs(store.getState());
      if (
        prevId === FALLBACK_WINDOW_ID &&
        ctx.windowId !== FALLBACK_WINDOW_ID
      ) {
        try {
          window.localStorage.removeItem(tabsPersistKey(prevId));
        } catch {
          // 忽略存储异常
        }
      }
    });
  }
}
