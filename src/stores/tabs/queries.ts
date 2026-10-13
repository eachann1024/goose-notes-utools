import { usePages } from "../usePages";
import { walkLeaves } from "@/lib/editor-split/tree";
import { useEditorSplit } from "../useEditorSplit";
import type { TabItem } from "./types";
import { isSpecialTab, getNotebookAiTabPageId } from "./identity";

export const createTabId = (pageId: string) =>
  `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${pageId.slice(0, 6)}`;

export const getWorkspaceIdForPage = (pageId: string): string | undefined =>
  usePages.getState().getPage(pageId)?.workspaceId;

// 固定标签恒在最左；其余（预览/普通）一律保持插入顺序追加到右侧。
// 新建/新打开的标签因此始终落在最右边。
export const orderTabs = (tabs: TabItem[]): TabItem[] => {
  const pinned = tabs.filter((t) => t.pinned);
  const rest = tabs.filter((t) => !t.pinned);
  return [...pinned, ...rest];
};

export const applyPinnedOrder = orderTabs;

export function tabShowsPageId(tab: TabItem, pageId: string): boolean {
  if (tab.type === "welcome" || tab.type === "notebook-ai") return false;
  if (tab.pageId === pageId) return true;
  const split = useEditorSplit.getState().getStateForTab(tab.id);
  if (!split) return false;
  return walkLeaves(split.root).some((leaf) => leaf.pageId === pageId);
}

export const findTabByPageId = (tabs: TabItem[], pageId: string) =>
  tabs.find((tab) => tabShowsPageId(tab, pageId));

/** 关 Tab 时把聚焦页和所有分屏叶一起落盘，避免只 flush tab.pageId。 */
export function collectTabPageIds(tab: TabItem): string[] {
  const ids = new Set<string>();
  if (tab.pageId) ids.add(tab.pageId);
  const split = useEditorSplit.getState().getStateForTab(tab.id);
  if (split) {
    for (const leaf of walkLeaves(split.root)) {
      if (leaf.pageId) ids.add(leaf.pageId);
    }
  }
  return [...ids];
}

export function collectTabsPageIds(tabs: TabItem[]): string[] {
  const ids = new Set<string>();
  for (const tab of tabs) {
    if (isSpecialTab(tab)) continue;
    for (const pageId of collectTabPageIds(tab)) ids.add(pageId);
  }
  return [...ids];
}

export function focusTabLeafForPage(tabId: string, pageId: string): void {
  const split = useEditorSplit.getState();
  const state = split.getStateForTab(tabId);
  if (!state) return;
  const leaf = walkLeaves(state.root).find((item) => item.pageId === pageId);
  if (leaf) split.focusPane(tabId, leaf.id);
}

/** 打开/激活工作区 tab 时立刻种 split，避免 EditorSplitSurface 第一帧空白。 */
export function ensureSplitForWorkspaceTab(
  tab: TabItem | null | undefined,
): void {
  if (!tab || isSpecialTab(tab) || !tab.pageId) return;
  useEditorSplit.getState().ensureTab(tab.id, tab.pageId);
}

export const findNotebookAiTabInList = (tabs: TabItem[], notebookId: string) =>
  tabs.find(
    (tab) =>
      tab.type === "notebook-ai" &&
      (tab.workspaceId === notebookId ||
        tab.pageId === getNotebookAiTabPageId(notebookId)),
  );

export const stampTabAccess = (tab: TabItem, now = Date.now()): TabItem => ({
  ...tab,
  lastAccessedAt: now,
});

/** 分屏 tab 以聚焦叶的 pageId 为准，避免切回标签时侧栏高亮停在旧页。 */
export function workspaceTabPageId(tab: TabItem): string {
  return useEditorSplit.getState().focusedPageId(tab.id) ?? tab.pageId;
}

export function syncEditorSplitsToOpenTabs(
  openTabs: TabItem[],
  activeTabId: string | null,
) {
  const split = useEditorSplit.getState();
  const openIds = new Set(openTabs.map((tab) => tab.id));
  for (const tabId of Object.keys(split.byTabId)) {
    if (!openIds.has(tabId)) split.clearTab(tabId);
  }
  const active = openTabs.find((tab) => tab.id === activeTabId);
  ensureSplitForWorkspaceTab(active);
}

export const clampHistoryIndex = (
  historyLength: number,
  currentIndex: number,
) => {
  if (historyLength === 0) return -1;
  if (currentIndex < 0) return 0;
  return Math.min(currentIndex, historyLength - 1);
};

export const resolveTabIdInHistory = (
  tabId: string | null | undefined,
  openTabs: TabItem[],
) => {
  if (!tabId) return null;
  return openTabs.some((tab) => tab.id === tabId) ? tabId : null;
};
