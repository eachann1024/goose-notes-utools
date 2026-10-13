import { create } from "zustand";
import { isElectronRuntime } from "@/lib/electron/runtime";
import {
  getWindowId,
  readWindowContextFromArgv,
} from "@/lib/electron/windowContext";
import type {
  TabsPersistenceState,
  TabsPageSaveState,
  TabsState,
} from "./tabs/types";
import { createTabsPersistence } from "./tabs/persistence";
import { createPageSaveHelpers } from "./tabs/pageSaves";
import { createHistoryHelpers } from "./tabs/historyHelpers";
import { createSingleTabHelpers } from "./tabs/singleTabHelpers";
import { createSyncActions } from "./tabs/syncActions";
import { createOpenPageActions } from "./tabs/openPageActions";
import { createSpecialTabActions } from "./tabs/specialTabActions";
import { createCloseActions } from "./tabs/closeActions";
import { createHistoryActions } from "./tabs/historyActions";
import { createTransferActions } from "./tabs/transferActions";
import { createOrderingActions } from "./tabs/orderingActions";
import { createMaintenanceActions } from "./tabs/maintenanceActions";
import { createDeletedPageActions } from "./tabs/deletedPageActions";
import { registerTabsLifecycle } from "./tabs/lifecycle";

export {
  WELCOME_TAB_PAGE_ID,
  NOTEBOOK_AI_TAB_PAGE_ID_PREFIX,
  getNotebookAiTabPageId,
  isNotebookAiTab,
  isSpecialTab,
} from "./tabs/identity";
export type { TabType, TabItem } from "./tabs/types";

const argvWindowContext = readWindowContextFromArgv();
// 状态由 facade 唯一持有；持久化与窗口生命周期共享同一个对象。
const persistenceState: TabsPersistenceState = {
  tabsWindowId: argvWindowContext?.windowId ?? getWindowId(),
  // Electron 的 IPC 给出 windowId 前，保护无后缀 / :main 的持久化键。
  persistReady: Boolean(argvWindowContext) || !isElectronRuntime(),
  persistScheduled: false,
  pendingPersistState: null,
};
const persistence = createTabsPersistence(persistenceState);
const { loadPersistedTabs } = persistence;
const pageSaveState: TabsPageSaveState = {
  setActivePageChain: Promise.resolve(),
};
const { scheduleSetActivePage } = createPageSaveHelpers(pageSaveState);

export const useTabs = create<TabsState>()((set, get) => {
  let singleTabSwitchToken = 0;
  const singleTabToken = {
    get current() {
      return singleTabSwitchToken;
    },
    set current(value: number) {
      singleTabSwitchToken = value;
    },
  };
  const { syncHistoryWithOpenTabs, pushTabHistory, stepFileNavHistory } =
    createHistoryHelpers({ set, get });
  const { replaceWithSinglePage, replaceWithSingleWelcome } =
    createSingleTabHelpers({
      set,
      get,
      scheduleSetActivePage,
      switchToken: singleTabToken,
    });
  const persisted = loadPersistedTabs();
  return {
    openTabs: persisted?.openTabs ?? [],
    activeTabId: persisted?.activeTabId ?? null,
    tabHistory: [],
    tabHistoryIndex: -1,
    isHistoryNavigating: false,
    recentlyClosedPageIds: persisted?.recentlyClosedPageIds ?? [],
    ...createSyncActions({
      set,
      get,
      scheduleSetActivePage,
      pushTabHistory,
      replaceWithSinglePage,
      replaceWithSingleWelcome,
    }),
    ...createOpenPageActions({
      set,
      get,
      scheduleSetActivePage,
      syncHistoryWithOpenTabs,
      pushTabHistory,
      replaceWithSinglePage,
    }),
    ...createSpecialTabActions({
      set,
      get,
      pushTabHistory,
      replaceWithSingleWelcome,
    }),
    ...createCloseActions({
      set,
      get,
      scheduleSetActivePage,
      syncHistoryWithOpenTabs,
    }),
    ...createHistoryActions({ set, get, stepFileNavHistory }),
    ...createTransferActions({
      set,
      get,
      scheduleSetActivePage,
      syncHistoryWithOpenTabs,
      pushTabHistory,
    }),
    ...createOrderingActions({ set, get }),
    ...createMaintenanceActions({
      set,
      get,
      scheduleSetActivePage,
      syncHistoryWithOpenTabs,
    }),
    ...createDeletedPageActions({
      set,
      get,
      scheduleSetActivePage,
      syncHistoryWithOpenTabs,
    }),
  };
});

registerTabsLifecycle(useTabs, persistenceState, persistence);
