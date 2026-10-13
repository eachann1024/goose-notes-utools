import { requestPageTitleFocus } from "@/lib/page-title-focus";
import { effectiveSingleTabMode } from "@/lib/tabMode";

// 单元测试没有 vite define，用 typeof 兜底避免 ReferenceError。
export const isElectronHostTarget = () =>
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron";

/**
 * 新建页聚焦策略：
 * - 单标签 / 仅一个文档标签：页头或标签 pill 上的 SingleTabTitle 响应 requestPageTitleFocus
 * - 多个文档标签 + 本地文件：正文上方 LocalFileTitle 响应 requestPageTitleFocus
 * - 多个文档标签 + 内部页：focus-editor-start 把光标放到首块 H1 标题末尾
 */
export function focusNewPage(pageId: string) {
  requestPageTitleFocus(pageId);
  if (effectiveSingleTabMode()) {
    return;
  }
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
    }, 100);
  }
}
