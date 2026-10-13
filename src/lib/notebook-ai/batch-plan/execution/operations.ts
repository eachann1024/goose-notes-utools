import type { BatchPlanOperationInput } from "../types";
import type {
  BatchOperationContext,
  BatchOperationExecution,
} from "./operationTypes";
import {
  runCreateOperation,
  runEditOperation,
  runSearchReplaceOperation,
} from "./operationWrites";
import { runDeleteOperation } from "./operationDelete";

export async function runOperation(
  operation: BatchPlanOperationInput,
  context: BatchOperationContext,
): Promise<BatchOperationExecution> {
  if (operation.type === "create")
    return runCreateOperation(operation, context);
  if (operation.type === "edit") return runEditOperation(operation, context);
  if (operation.type === "search_replace")
    return runSearchReplaceOperation(operation, context);
  if (operation.type === "delete")
    return runDeleteOperation(operation, context);
  const unsupported: never = operation;
  throw new Error(
    `暂不支持的操作类型: ${(unsupported as { type?: string }).type ?? "unknown"}`,
  );
}
