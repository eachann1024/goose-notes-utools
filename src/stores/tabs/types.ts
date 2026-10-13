import type { StoreApi } from "zustand";

export type TabType = "welcome" | "notebook-ai";

export interface TabItem {
  id: string;
  pageId: string;
  type?: TabType;
  pinned?: boolean;
  /** 预览/临时标签：侧栏单击打开，可被下一个预览替换；编辑后晋升永久 */
  preview?: boolean;
  workspaceId?: string;
  lastAccessedAt?: number;
}

export interface TabsState {
  openTabs: TabItem[];
  activeTabId: string | null;
  tabHistory: string[];
  tabHistoryIndex: number;
  isHistoryNavigating: boolean;
  recentlyClosedPageIds: string[];
  syncNotebookForPage: (pageId: string | null) => void;
  syncActiveTabForPage: (pageId: string | null) => void;
  openTab: (pageId: string) => void;
  openWelcomeTab: () => void;
  openNewTab: () => void;
  openNotebookAiTab: (notebookId: string) => void;
  closeNotebookAiTab: (notebookId: string) => void;
  findNotebookAiTab: (notebookId: string) => TabItem | undefined;
  openPreviewTab: (pageId: string) => void;
  openPermanentTab: (pageId: string, options?: { pin?: boolean }) => void;
  promotePreviewTab: (tabId?: string) => void;
  openInCurrentTab: (pageId: string) => void;
  /** 分屏聚焦叶变化时只改 pageId，不拆 split、不开新 Tab。 */
  syncTabPageId: (tabId: string, pageId: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  togglePinTab: (tabId: string) => void;
  goBackTabHistory: () => void;
  goForwardTabHistory: () => void;
  canGoBackTabHistory: () => boolean;
  canGoForwardTabHistory: () => boolean;
  reorderTabs: (from: number, to: number) => void;
  adoptTab: (tab: TabItem, insertIndex?: number) => void;
  releaseTab: (tabId: string) => { emptied: boolean };
  removeDeletedPage: (pageId: string) => void;
  reopenLastClosedTab: () => void;
  reconcileTabs: () => void;
  closeExpiredTabs: (now?: number) => void;
  clearAllTabs: () => void;
  collapseToActiveTab: () => void;
}

export interface PersistedTabs {
  openTabs: TabItem[];
  activeTabId: string | null;
  recentlyClosedPageIds: string[];
}

export interface TabsStoreContext {
  set: StoreApi<TabsState>["setState"];
  get: StoreApi<TabsState>["getState"];
}

export interface TabsActionHelpers {
  scheduleSetActivePage: (pageId: string | null) => Promise<void>;
  syncHistoryWithOpenTabs: (
    tabs: TabItem[],
  ) => Pick<TabsState, "tabHistory" | "tabHistoryIndex">;
  pushTabHistory: (tabId: string) => void;
  stepFileNavHistory: (direction: "back" | "forward") => void;
  replaceWithSinglePage: (pageId: string) => Promise<void>;
  replaceWithSingleWelcome: () => Promise<void>;
}

export interface TabsPersistenceState {
  tabsWindowId: string;
  persistReady: boolean;
  persistScheduled: boolean;
  pendingPersistState: TabsState | null;
}

export interface TabsPersistenceHelpers {
  readPersistedTabsRaw: (key: string) => PersistedTabs | null;
  loadPersistedTabs: () => PersistedTabs | null;
  persistTabs: (state: TabsState) => void;
}

export interface TabsPageSaveState {
  setActivePageChain: Promise<void>;
}

export type TabsLifecycleStore = Pick<
  StoreApi<TabsState>,
  "getState" | "setState" | "subscribe"
>;
