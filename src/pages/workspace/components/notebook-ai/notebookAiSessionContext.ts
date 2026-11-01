/**
 * Notebook AI 会话上下文（轻量模块）。
 *
 * 只含 context 与读取钩子，不引用 AI SDK；工作区常驻层靠它包住编辑区，
 * 重型会话运行时（NotebookAiSession.tsx）懒加载后把值推进来。
 */
import { createContext, useContext } from "react";
import type { NotebookAiSessionValue } from "./NotebookAiSession";

export const NotebookAiSessionContext =
  createContext<NotebookAiSessionValue | null>(null);

export function useNotebookAiSession(): NotebookAiSessionValue {
  const value = useContext(NotebookAiSessionContext);
  if (!value) {
    throw new Error(
      "useNotebookAiSession 必须在 NotebookAiSessionSlot 内且会话运行时已加载后使用",
    );
  }
  return value;
}

/** 会话运行时尚未加载或 AI 不可用时返回 null。 */
export function useOptionalNotebookAiSession(): NotebookAiSessionValue | null {
  return useContext(NotebookAiSessionContext);
}
