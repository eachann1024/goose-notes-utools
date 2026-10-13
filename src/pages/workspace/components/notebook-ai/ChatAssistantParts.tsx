import type { ReactNode } from "react";
import { useState, useContext } from "react";
import type { TextMessagePartProps, ToolCallMessagePartProps } from "@assistant-ui/react";
import { AssistantToolRenderContext } from "./ChatMessageContext";
import { AssistantStreamdownText } from "./ChatAssistantMarkdown";
import type { ToolDisplayPart } from "./toolProgressVisibility";
import { shouldShowToolPart } from "./ChatMessageState";
import { ApprovalPlanCard } from "./ApprovalPlanCard";
import { renderToolVisual } from "./ChatToolVisuals";

function LetterFoldChevron() {
  return (
    <svg
      className="notebook-ai-letter-chev"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** 有变更计划时，把说明收进折叠，默认收起，把版面让给整页改动。 */
export function AssistantLetterFold({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="notebook-ai-letter-fold">
      <button
        type="button"
        className="notebook-ai-letter-fold-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LetterFoldChevron />
        <span>思考</span>
      </button>
      {open ? (
        <div className="notebook-ai-letter-fold-body">{children}</div>
      ) : null}
    </div>
  );
}

/** 从 context 读 isStreaming，避免 stream 结束时换 Text 组件类型导致整段 remount */
function AssistantTextPart({ text, status }: TextMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  // 多轮工具调用会留下多段正文；只有当前仍在输出的 part 才是 running
  const isPartStreaming =
    Boolean(ctx?.isStreaming) && status.type === "running";
  return (
    <AssistantStreamdownText
      text={text}
      isStreaming={isPartStreaming}
      editorRef={ctx?.editorRef}
    />
  );
}

/** 工作卡 footer：只渲染 executeBatchPlan 的 embedded 审批，其余 part 一律 null */
function AssistantApprovalPart({ artifact }: ToolCallMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  if (!ctx) return null;
  const { isStreaming, onBatchApproval, onBatchUndo } = ctx;
  const part = artifact as ToolDisplayPart | undefined;
  if (!part || part.type !== "tool-executeBatchPlan") return null;
  if (!shouldShowToolPart(part, isStreaming)) return null;
  if (
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "call" ||
    part.state === "partial-call"
  ) {
    return null;
  }
  return (
    <ApprovalPlanCard
      part={part}
      onApprovalResponse={onBatchApproval}
      onUndo={onBatchUndo}
      embedded
    />
  );
}

/** 纸外 artifact：只渲染 Table/Chart/Diagram/Svg，text 与审批一律 null */
function AssistantArtifactPart({ artifact }: ToolCallMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  if (!ctx) return null;
  const { isStreaming, editorRef } = ctx;
  const part = artifact as ToolDisplayPart | undefined;
  if (!part || part.type === "tool-executeBatchPlan") return null;
  if (!shouldShowToolPart(part, isStreaming)) return null;
  return renderToolVisual(
    part,
    part.toolCallId ?? part.type,
    editorRef,
    isStreaming,
  );
}

function NullMessagePart() {
  return null;
}

/**
 * MessagePrimitive.Parts 的 components 必须模块级常量，避免 identity 抖动。
 * 同一条消息拆三份 map 各渲一类 part、其余 null，防止正文/审批/artifact 双渲染。
 */
export const ASSISTANT_TEXT_PARTS = {
  Text: AssistantTextPart,
  Reasoning: NullMessagePart,
  tools: { Override: NullMessagePart },
};

export const ASSISTANT_APPROVAL_PARTS = {
  Text: NullMessagePart,
  Reasoning: NullMessagePart,
  tools: { Override: AssistantApprovalPart },
};

export const ASSISTANT_ARTIFACT_PARTS = {
  Text: NullMessagePart,
  Reasoning: NullMessagePart,
  tools: { Override: AssistantArtifactPart },
};
