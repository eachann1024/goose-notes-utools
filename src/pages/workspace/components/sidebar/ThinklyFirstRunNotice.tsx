import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { UToolsAdapter } from "@/lib/utools";
import goose from "@/assets/thinkly-goose.webp";
import "./thinkly-first-run-notice.css";

const THINKLY_URL = "https://note.cooool.top/";

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
  const [windowVisible, setWindowVisible] = useState(!document.hidden);

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

  return (
    <div className="thinkly-notice-slot">
      <div className="thinkly-notice-slip">
        <button
          type="button"
          className="thinkly-notice-expand"
          aria-label="前往 Thinkly 官网"
          title="前往 Thinkly 官网下载桌面版"
          onClick={() => {
            dismiss();
            UToolsAdapter.openUrl(THINKLY_URL, false);
          }}
        >
          <img
            className="thinkly-notice-peek"
            src={goose}
            alt=""
            width={58}
            height={58}
          />
          <span className="thinkly-notice-slip-title">
            鹅的笔记
          </span>
          <span className="thinkly-notice-slip-copy">
            不开 uTools 也能记
          </span>
        </button>
        <button
          type="button"
          className="thinkly-notice-close thinkly-notice-slip-close"
          aria-label="不再显示"
          title="不再显示"
          onClick={dismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
