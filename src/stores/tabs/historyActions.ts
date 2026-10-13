import { useFileNavHistory } from "../useFileNavHistory";
import type { TabsStoreContext, TabsActionHelpers, TabsState } from "./types";

export function createHistoryActions({
  set,
  get,
  stepFileNavHistory,
}: TabsStoreContext & Pick<TabsActionHelpers, "stepFileNavHistory">): Pick<
  TabsState,
  | "goBackTabHistory"
  | "goForwardTabHistory"
  | "canGoBackTabHistory"
  | "canGoForwardTabHistory"
> {
  return {
    goBackTabHistory: () => {
      set({ isHistoryNavigating: true });
      try {
        stepFileNavHistory("back");
      } finally {
        set({ isHistoryNavigating: false });
      }
    },
    goForwardTabHistory: () => {
      set({ isHistoryNavigating: true });
      try {
        stepFileNavHistory("forward");
      } finally {
        set({ isHistoryNavigating: false });
      }
    },
    canGoBackTabHistory: () => useFileNavHistory.getState().canBack(),
    canGoForwardTabHistory: () => useFileNavHistory.getState().canForward(),
  };
}
