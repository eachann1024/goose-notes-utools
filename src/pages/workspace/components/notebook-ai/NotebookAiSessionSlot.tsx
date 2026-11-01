/**
 * Notebook AI 会话插槽：常驻包住编辑区，树结构不随 AI 加载状态变化，
 * 避免重型运行时就绪时把编辑区整体重挂。
 *
 * 会话运行时（AI SDK、工具、导出序列化等）作为兄弟节点懒加载：
 * 首屏后空闲时加载；用户已经要打开 AI 面板时立即加载。
 */
import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { NotebookAiSessionValue } from "./NotebookAiSession";
import { NotebookAiSessionContext } from "./notebookAiSessionContext";

const loadNotebookAiSessionRuntime = () => import("./NotebookAiSession");

const NotebookAiSessionRuntime = lazy(() =>
  loadNotebookAiSessionRuntime().then((m) => ({
    default: memo(m.NotebookAiSessionRuntime),
  })),
);

interface NotebookAiSessionSlotProps {
  /** null 表示当前不提供 AI 会话（AI 关闭或没有可用笔记本）。 */
  notebookId: string | null;
  /** 面板已要求打开：不等空闲，立即加载运行时。 */
  eager: boolean;
  children: ReactNode;
}

export function NotebookAiSessionSlot({
  notebookId,
  eager,
  children,
}: NotebookAiSessionSlotProps) {
  const [value, setValue] = useState<NotebookAiSessionValue | null>(null);
  const [runtimeRequested, setRuntimeRequested] = useState(false);
  const enabled = Boolean(notebookId);

  if (enabled && eager && !runtimeRequested) {
    setRuntimeRequested(true);
  }

  useEffect(() => {
    if (!enabled || runtimeRequested) return;
    const request = () => setRuntimeRequested(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(request, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(request, 1500);
    return () => window.clearTimeout(timer);
  }, [enabled, runtimeRequested]);

  return (
    <NotebookAiSessionContext.Provider value={enabled ? value : null}>
      {notebookId && runtimeRequested ? (
        <Suspense fallback={null}>
          <NotebookAiSessionRuntime
            notebookId={notebookId}
            onValueChange={setValue}
          />
        </Suspense>
      ) : null}
      {children}
    </NotebookAiSessionContext.Provider>
  );
}
