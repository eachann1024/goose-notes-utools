import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { UToolsAdapter } from "@/lib/utools";
import { BLOCK_APP } from "./settings-dialog/configuration";
import "./thinkly-first-run-notice.css";

// 会话状态与持久化分开：写入「已展示」后，本次会话依然可见。
// 模块状态同时避免 StrictMode 重挂载或侧栏重挂载导致通知提前消失。
let sessionVisible: boolean | undefined;
let sessionMarked = false;

if (typeof window !== "undefined") {
  const resetSession = () => {
    sessionVisible = false;
  };
  window.addEventListener("goose-note:plugin-out", resetSession);
  window.addEventListener("pagehide", resetSession);
}

export default function ThinklyFirstRunNotice({ hidden }: { hidden: boolean }) {
  const [visible, setVisible] = useState(() => {
    sessionVisible ??= Boolean(
      window.gooseFirstRunNotice && !window.gooseFirstRunNotice.hasSeen(),
    );
    return sessionVisible;
  });
  const [windowVisible, setWindowVisible] = useState(!document.hidden);

  useEffect(() => {
    const updateVisibility = () => setWindowVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => () => {
    if (sessionMarked) sessionVisible = false;
  }, []);

  useLayoutEffect(() => {
    if (!visible || hidden || !windowVisible || sessionMarked) return;
    // 首次真正挂到可见侧栏就写入，不能等关闭或退出事件。
    // home 无法写入时不展示，以免卸载重装后重复打扰。
    if (!window.gooseFirstRunNotice?.markSeen()) {
      sessionVisible = false;
      // 持久化失败必须在浏览器绘制前撤回，避免闪现后下次又展示。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    sessionMarked = true;
  }, [visible, hidden, windowVisible]);

  useEffect(() => {
    // uTools 关闭主窗口时可能只退到后台，React 不卸载；再次进入也不能重现。
    const onExit = () => {
      sessionVisible = false;
      setVisible(false);
    };
    window.addEventListener("goose-note:plugin-out", onExit);
    window.addEventListener("pagehide", onExit);
    return () => {
      window.removeEventListener("goose-note:plugin-out", onExit);
      window.removeEventListener("pagehide", onExit);
    };
  }, []);

  const dismiss = () => {
    sessionVisible = false;
    setVisible(false);
  };

  const handleOpenBlock = () => {
    dismiss();
    UToolsAdapter.openUrl(BLOCK_APP.url, false);
  };

  if (!visible || hidden || !windowVisible) return null;

  return (
    <div className="thinkly-notice-slot">
      <section
        aria-label="Block 推荐"
        className="thinkly-notice-slip relative flex flex-col gap-2 rounded-[12px] border border-[#e6e6e6] dark:border-border bg-white dark:bg-card p-2.5 text-card-foreground"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]"
          aria-label="关闭推荐"
        >
          <X className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={handleOpenBlock}
          className="flex w-full cursor-pointer items-center gap-2 rounded-[8px] border-0 bg-transparent p-0 text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={BLOCK_APP.icon}
            alt=""
            className="h-7 w-7 shrink-0 rounded-[7px] object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="whitespace-nowrap pr-3.5 text-[13px] font-semibold leading-[17px] text-foreground">
              鹅的笔记 完全体
            </span>
            <span className="whitespace-nowrap text-xs leading-[15px] text-muted-foreground">
              小鹅也梳上背头啦
            </span>
          </div>
        </button>

        <div className="grid grid-cols-3 gap-1">
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-[7px] bg-[#f4f6fa] dark:bg-[hsl(var(--goose-selected-bg))] px-0.5 py-1.5 text-center">
            <span className="whitespace-nowrap text-[11px] font-semibold leading-[15px] tracking-[-0.02em] tabular-nums text-[#4a7be6] dark:text-[#6b9dff]">
              24.5 ms
            </span>
            <span className="whitespace-nowrap text-[11px] leading-[14px] tracking-[-0.02em] text-muted-foreground">
              瞬间打开
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-[7px] bg-[#f4f6fa] dark:bg-[hsl(var(--goose-selected-bg))] px-0.5 py-1.5 text-center">
            <span className="whitespace-nowrap text-[11px] font-semibold leading-[15px] tracking-[-0.02em] tabular-nums text-[#4a7be6] dark:text-[#6b9dff]">
              117 MB
            </span>
            <span className="whitespace-nowrap text-[11px] leading-[14px] tracking-[-0.02em] text-muted-foreground">
              内存
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-[7px] bg-[#f4f6fa] dark:bg-[hsl(var(--goose-selected-bg))] px-0.5 py-1.5 text-center">
            <span className="whitespace-nowrap text-[11px] font-semibold leading-[15px] tracking-[-0.02em] tabular-nums text-[#4a7be6] dark:text-[#6b9dff]">
              27 MB
            </span>
            <span className="whitespace-nowrap text-[11px] leading-[14px] tracking-[-0.02em] text-muted-foreground">
              体积
            </span>
          </div>
        </div>

        <p className="m-0 whitespace-nowrap text-[11px] leading-[16px] tracking-[-0.02em] text-muted-foreground">
          10 万块文档即开即写，依然免费
          <br />
          我奶的电脑都能秒开!
        </p>

        <button
          type="button"
          onClick={handleOpenBlock}
          className="flex h-7 w-full cursor-pointer items-center justify-center rounded-[8px] bg-[#4a7be6] text-xs font-medium text-white transition-colors hover:bg-[#3563c9] active:bg-[#2c53a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          去看看
        </button>
      </section>
    </div>
  );
}
