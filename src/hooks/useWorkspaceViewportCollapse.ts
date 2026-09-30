import { useSidebarView } from "@/stores/useSidebarView";

/** uTools 不跟窗口宽度收侧栏，只认用户自己点的折叠。 */
export function useEffectiveSidebarCollapsed(): boolean {
  return useSidebarView((state) => state.sidebarCollapsed);
}
