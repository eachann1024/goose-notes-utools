import { formatBatchPlanErrors } from "@/lib/notebook-ai/errors";
import { writeBatchPlanJournal } from "../journal";
import type {
  BatchOperationResult,
  BatchPlanExecuteResult,
  BatchPlanJournal,
} from "../types";
import { recoverInterruptedOperation } from "./recovery";
import { preflight } from "./preflight";
import type { BatchOperationContext } from "./operationTypes";
import { pendingOperations } from "./snapshots";
import { runOperation } from "./operations";
import { compensate } from "./compensate";

export async function run(
  journal: BatchPlanJournal,
): Promise<BatchPlanExecuteResult> {
  if (journal.status === "completed")
    return { ok: true, journal, results: journal.results };
  if (journal.status === "invalid")
    return {
      ok: false,
      journal,
      error: journal.error || "计划无效",
      results: journal.results,
    };
  if (journal.selectedOperationIds.length === 0) {
    const invalid = writeBatchPlanJournal({
      ...journal,
      status: "invalid",
      error: "至少选择一项操作后才能执行",
    });
    return {
      ok: false,
      journal: invalid,
      error: invalid.error!,
      results: invalid.results,
    };
  }
  const recovered = await recoverInterruptedOperation(journal);
  if (recovered.status === "failed") {
    return {
      ok: false,
      journal: recovered,
      error: recovered.error || "中断恢复失败",
      results: recovered.results,
    };
  }
  const conflict = await preflight(recovered);
  if (conflict) {
    const failed = writeBatchPlanJournal({
      ...recovered,
      status: "failed",
      error: conflict,
    });
    return {
      ok: false,
      journal: failed,
      error: conflict,
      results: failed.results,
    };
  }
  const context: BatchOperationContext = {
    working: writeBatchPlanJournal({
      ...recovered,
      status: "executing",
      error: undefined,
    }),
  };
  for (const operation of pendingOperations(context.working)) {
    // 每项真正写入前先持久化 intent；崩溃后不会把“未开始”误报成成功。
    context.working = writeBatchPlanJournal({
      ...context.working,
      executingOperationId: operation.operationId,
      executingStartedAt: Date.now(),
    });
    let result: BatchOperationResult;
    try {
      const executed = await runOperation(operation, context);
      result = executed.result;
      if (executed.recorded) continue;
    } catch (error) {
      result = {
        operationId: operation.operationId,
        type: operation.type,
        ok: false,
        pageIds:
          operation.type === "delete"
            ? operation.pageIds
            : operation.type === "edit" || operation.type === "search_replace"
              ? [operation.pageId]
              : [],
        error: error instanceof Error ? error.message : "执行失败",
      };
      context.working = writeBatchPlanJournal({
        ...context.working,
        results: [...context.working.results, result],
        status: "failed",
        error: result.error,
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
      const compensationErrors = await compensate(context.working);
      if (compensationErrors.length > 0) {
        context.working = writeBatchPlanJournal({
          ...context.working,
          error: formatBatchPlanErrors([
            result.error ?? "",
            ...compensationErrors,
          ]),
        });
      }
      return {
        ok: false,
        journal: context.working,
        error: context.working.error!,
        results: context.working.results,
      };
    }
    context.working = writeBatchPlanJournal({
      ...context.working,
      results: [...context.working.results, result],
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  context.working = writeBatchPlanJournal({
    ...context.working,
    status: "completed",
  });
  return {
    ok: true,
    journal: context.working,
    results: context.working.results,
  };
}
