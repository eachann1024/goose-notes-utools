import { writeBatchPlanJournal } from "../journal";
import type { BatchPlanJournal } from "../types";
import { resultForOperation } from "./snapshots";
import {
  recoverCreateOperation,
  recoverEditOperation,
  recoverSearchReplaceOperation,
} from "./recoveryWrites";
import { recoverDeleteOperation } from "./recoveryDelete";

/** 将崩溃时已写 intent、但还来不及记录 result 的操作安全归类。 */
export async function recoverInterruptedOperation(
  journal: BatchPlanJournal,
): Promise<BatchPlanJournal> {
  const operationId = journal.executingOperationId;
  if (!operationId) return journal;
  const operation = journal.input.operations.find(
    (item) => item.operationId === operationId,
  );
  if (!operation) {
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "执行日志指向不存在的操作",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  if (resultForOperation(journal, operationId)) {
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  if (operation.type === "create") {
    return recoverCreateOperation(journal, operation, operationId);
  }
  if (operation.type === "edit") {
    return recoverEditOperation(journal, operation, operationId);
  }
  if (operation.type === "search_replace") {
    return recoverSearchReplaceOperation(journal, operation, operationId);
  }
  if (operation.type !== "delete") {
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断操作类型暂不支持恢复",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  return recoverDeleteOperation(journal, operation, operationId);
}
