import { readBatchPlanJournal } from "./journal";
import type { BatchPlanExecuteResult } from "./types";
import { run } from "./execution/run";

export { prepareBatchPlan } from "./execution/prepare";
export { undoBatchPlan } from "./execution/undo";

const inFlight = new Map<string, Promise<BatchPlanExecuteResult>>();

export function executePreparedBatchPlan(
  toolCallId: string,
  runId: string,
): Promise<BatchPlanExecuteResult> {
  const key = `${toolCallId}:${runId}`;
  const current = inFlight.get(key);
  if (current) return current;
  const journal = readBatchPlanJournal(toolCallId, runId);
  if (!journal) return Promise.reject(new Error("未找到批量计划"));
  const promise = run(journal).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
