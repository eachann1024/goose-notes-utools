import type { BatchOperationResult, BatchPlanJournal } from "../types";

/** run 持有 journal；处理器立即写回中间状态，让失败补偿看到已发生的变化。 */
export interface BatchOperationContext {
  working: BatchPlanJournal;
}

export interface BatchOperationExecution {
  result: BatchOperationResult;
  recorded: boolean;
}
