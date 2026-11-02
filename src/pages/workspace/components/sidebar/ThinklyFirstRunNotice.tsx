import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { UToolsAdapter } from "@/lib/utools";
import goose from "@/assets/thinkly-goose.webp";
import "./thinkly-first-run-notice.css";

// 会话状态与持久化分开：写入「已展示」后，本次会话依然可见。
// 模块状态同时避免 StrictMode 重挂载或侧栏重挂载导致通知提前消失。
let sessionVisible: boolean | undefined;
let sessionMarked = false;

export default function ThinklyFirstRunNotice({ hidden }: { hidden: boolean }) {
  const [visible, setVisible] = useState(() => {
    sessionVisible ??= Boolean(
      window.gooseFirstRunNotice && !window.gooseFirstRunNotice.hasSeen(),
    );
    return sessionVisible;
  });
  const [expanded, setExpanded] = useState(false);
  const [windowVisible, setWindowVisible] = useState(!document.hidden);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateVisibility = () => setWindowVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
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

  useLayoutEffect(() => {
    if (expanded && !hidden) closeRef.current?.focus({ preventScroll: true });
  }, [expanded, hidden]);

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

  if (!visible || hidden || !windowVisible) return null;

  if (expanded) {
    return createPortal(
      <section
        className="thinkly-notice-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="thinkly-notice-title"
        aria-describedby="thinkly-notice-description"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            dismiss();
          }
        }}
      >
        <div className="thinkly-notice-art" aria-hidden="true">
          <div className="thinkly-notice-mini-window">
            <div className="thinkly-notice-window-dots">
              <i />
              <i />
              <i />
            </div>
            <div className="thinkly-notice-window-title" />
            <div className="thinkly-notice-window-line" />
            <div className="thinkly-notice-window-line" />
            <div className="thinkly-notice-window-line" />
          </div>
          <img
            className="thinkly-notice-goose"
            src={goose}
            alt=""
            width={150}
            height={150}
          />
        </div>
        <button
          ref={closeRef}
          type="button"
          className="thinkly-notice-close thinkly-notice-card-close"
          aria-label="不再显示"
          onClick={dismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
        <div className="thinkly-notice-body">
          <div>
            <h2 id="thinkly-notice-title">安放每一瞬念头，随时向过去提问</h2>
            <p id="thinkly-notice-description">
              Thinkly 是鹅的笔记的桌面版：直接打开本地 Markdown
              文件夹，独立速记小窗随叫随到，AI 引用你写过的内容作答。
            </p>
          </div>
          <div className="thinkly-notice-actions">
            <button
              type="button"
              className="thinkly-notice-download"
              onClick={() => {
                dismiss();
                UToolsAdapter.openUrl("https://note.cooool.top/", false);
              }}
            >
              下载 Thinkly <ArrowUpRight size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="thinkly-notice-stay"
              onClick={dismiss}
            >
              留在 uTools
            </button>
          </div>
        </div>
      </section>,
      document.body,
    );
  }

  return (
    <div className="thinkly-notice-slot">
      <div className="thinkly-notice-slip">
        <button
          type="button"
          className="thinkly-notice-expand"
          aria-label="了解 Thinkly 桌面版"
          aria-haspopup="dialog"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <img
            className="thinkly-notice-peek"
            src={goose}
            alt=""
            width={58}
            height={58}
          />
          <span
            className="thinkly-notice-slip-title"
            title="鹅搬到桌面了 · Thinkly"
          >
            鹅搬到桌面了 · Thinkly
          </span>
          <span className="thinkly-notice-slip-copy">
            不开 uTools 也能随手记
          </span>
        </button>
        <button
          type="button"
          className="thinkly-notice-close thinkly-notice-slip-close"
          aria-label="不再显示"
          onClick={dismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
