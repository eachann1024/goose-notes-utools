import {
  FALLBACK_WINDOW_ID,
  tabsPersistKey,
} from "@/lib/electron/windowContext";
import type {
  TabsPersistenceState,
  TabsPersistenceHelpers,
  PersistedTabs,
  TabsState,
} from "./types";

const LEGACY_TABS_PERSIST_KEY = "goose-note:open-tabs:v1";

export function createTabsPersistence(
  persistenceState: TabsPersistenceState,
): TabsPersistenceHelpers {
  const readPersistedTabsRaw = (key: string): PersistedTabs | null => {
    if (typeof window === "undefined") return null;
    try {
      const now = Date.now();
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PersistedTabs>;
      if (!Array.isArray(parsed.openTabs)) return null;
      return {
        openTabs: parsed.openTabs
          .filter(
            (t) =>
              t && typeof t.id === "string" && typeof t.pageId === "string",
          )
          .map((t) => ({
            ...t,
            lastAccessedAt:
              typeof t.lastAccessedAt === "number" &&
              Number.isFinite(t.lastAccessedAt)
                ? t.lastAccessedAt
                : now,
          })),
        activeTabId:
          typeof parsed.activeTabId === "string" ? parsed.activeTabId : null,
        recentlyClosedPageIds: Array.isArray(parsed.recentlyClosedPageIds)
          ? parsed.recentlyClosedPageIds.filter((id) => typeof id === "string")
          : [],
      };
    } catch {
      return null;
    }
  };

  const loadPersistedTabs = (): PersistedTabs | null => {
    if (!persistenceState.persistReady) return null;
    const keyed = readPersistedTabsRaw(
      tabsPersistKey(persistenceState.tabsWindowId),
    );
    if (keyed) return keyed;
    if (persistenceState.tabsWindowId !== FALLBACK_WINDOW_ID) return null;
    const legacy = readPersistedTabsRaw(LEGACY_TABS_PERSIST_KEY);
    if (!legacy || typeof window === "undefined") return legacy;
    try {
      window.localStorage.setItem(
        tabsPersistKey(FALLBACK_WINDOW_ID),
        JSON.stringify(legacy),
      );
      window.localStorage.removeItem(LEGACY_TABS_PERSIST_KEY);
    } catch {
      // 忽略存储异常（隐私模式 / 配额）
    }
    return legacy;
  };

  const persistTabs = (state: TabsState) => {
    if (typeof window === "undefined") return;
    if (!persistenceState.persistReady) return;
    persistenceState.pendingPersistState = state;
    if (persistenceState.persistScheduled) return;
    persistenceState.persistScheduled = true;
    queueMicrotask(() => {
      persistenceState.persistScheduled = false;
      const latestState = persistenceState.pendingPersistState;
      persistenceState.pendingPersistState = null;
      if (!latestState) return;
      try {
        const persistableTabs = latestState.openTabs.filter(
          (tab) => !tab.preview,
        );
        const activeStillValid = persistableTabs.some(
          (tab) => tab.id === latestState.activeTabId,
        );
        const payload: PersistedTabs = {
          openTabs: persistableTabs,
          activeTabId: activeStillValid
            ? latestState.activeTabId
            : (persistableTabs[persistableTabs.length - 1]?.id ?? null),
          recentlyClosedPageIds: latestState.recentlyClosedPageIds.slice(0, 10),
        };
        window.localStorage.setItem(
          tabsPersistKey(persistenceState.tabsWindowId),
          JSON.stringify(payload),
        );
      } catch {
        // 忽略存储异常（隐私模式 / 配额）
      }
    });
  };
  return { readPersistedTabsRaw, loadPersistedTabs, persistTabs };
}
