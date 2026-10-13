import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { BatchApprovalResponse } from "../ApprovalPlanCard";

export type BatchApprovalToolState =
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error";

/** 只转换对应 toolCallId 的展示 part，不执行工具或读取会话／日志。 */
export function replaceBatchApprovalToolParts(
  messages: NotebookAiMessage[],
  response: BatchApprovalResponse,
  state: BatchApprovalToolState,
  payload: { output?: unknown; errorText?: string } = {},
): NotebookAiMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: (message.parts ?? []).map((part) => {
      if (
        !(
          typeof part === "object" &&
          part &&
          "toolCallId" in part &&
          part.toolCallId === response.toolCallId
        )
      ) {
        return part;
      }
      return {
        ...part,
        state,
        ...(payload.output !== undefined ? { output: payload.output } : {}),
        ...(payload.errorText ? { errorText: payload.errorText } : {}),
        approval: {
          id: response.approvalId,
          approved: response.approved,
          reason: response.approved
            ? `用户批准执行 ${response.selectedOperationIds.length} 项操作`
            : "用户取消了整批计划",
        },
      } as unknown as typeof part;
    }),
  }));
}

/** 成功撤回时保留执行结果字段，仅改原有状态与撤回能力。 */
export function markBatchUndoToolParts(
  messages: NotebookAiMessage[],
  toolCallId: string,
): NotebookAiMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: (message.parts ?? []).map((part) => {
      if (
        !(
          typeof part === "object" &&
          part &&
          "toolCallId" in part &&
          part.toolCallId === toolCallId &&
          "output" in part &&
          part.output &&
          typeof part.output === "object"
        )
      ) {
        return part;
      }
      return {
        ...part,
        output: {
          ...(part.output as Record<string, unknown>),
          status: "undone",
          canUndo: false,
        },
      } as unknown as typeof part;
    }),
  }));
}
