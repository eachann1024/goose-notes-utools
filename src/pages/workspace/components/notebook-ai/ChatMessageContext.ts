import type { RefObject, ReactNode, Dispatch, SetStateAction } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";
import type { BatchApprovalResponse, BatchUndoResult } from "./ApprovalPlanCard";
import { createContext } from "react";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { PreviewContent } from "@/lib/preview/previewAction";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";

/** 工具 / 正文 part 共享的每消息上下文（组件函数本身保持模块级稳定） */
export interface AssistantToolRenderContextValue {
  isStreaming: boolean;
  editorRef?: RefObject<EditorRef | null>;
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void> | void;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

export const AssistantToolRenderContext =
  createContext<AssistantToolRenderContextValue | null>(null);

export interface ChatMessagesProps {
  messages: NotebookAiMessage[];
  /** 正在流式输出的消息 id（最后一条 assistant msg id）*/
  streamingMessageId?: string;
  editorRef?: RefObject<EditorRef | null>;
  /** 全屏会话更宽、居中；侧栏保持紧凑 */
  layout?: "side-panel" | "fullscreen";
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void> | void;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

export type MessageActionBarRenderer = () => ReactNode;
export interface UserMessageRenderInputs {
  setPreviewContent: Dispatch<SetStateAction<PreviewContent | null>>;
  onOpenPage: EditorPageContext['onOpenPage'];
  MessageActionBar: MessageActionBarRenderer;
}
export interface AssistantMessageRenderInputs {
  toolRenderBase: Omit<AssistantToolRenderContextValue, 'isStreaming'>;
  MessageActionBar: MessageActionBarRenderer;
}
