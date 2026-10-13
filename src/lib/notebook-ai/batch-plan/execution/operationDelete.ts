import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { writeBatchPlanJournal } from "../journal";
import type { BatchOperationResult, BatchPlanOperationInput } from "../types";
import type {
  BatchOperationContext,
  BatchOperationExecution,
} from "./operationTypes";
import { rememberBefore, revisionOf } from "./snapshots";
import { stageLocalDelete } from "./localDelete";

export async function runDeleteOperation(
  operation: Extract<BatchPlanOperationInput, { type: "delete" }>,
  context: BatchOperationContext,
): Promise<BatchOperationExecution> {
  let result: BatchOperationResult;
  const affectedPageIds =
    context.working.affectedPageIdsByOperationId[operation.operationId] ??
    operation.pageIds;
  for (const pageId of affectedPageIds)
    await rememberBefore(pageId, context.working);
  const localSnapshots = affectedPageIds.flatMap((pageId) => {
    const snapshot = context.working.before[pageId];
    return snapshot?.page.localFilePath ? [snapshot] : [];
  });
  if (localSnapshots.length > 0) {
    if (localSnapshots.length !== affectedPageIds.length) {
      throw new Error("删除计划不能混合本地文件和内置页面");
    }
    await stageLocalDelete(localSnapshots, context.working);
    result = {
      operationId: operation.operationId,
      type: operation.type,
      ok: true,
      pageIds: [...affectedPageIds],
    };
    context.working = writeBatchPlanJournal({
      ...context.working,
      results: [...context.working.results, result],
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
    return { result, recorded: true };
  }
  const deletedRootIds: string[] = [];
  const deleteBatchId =
    context.working.deleteBatchIdsByOperationId[operation.operationId];
  if (!deleteBatchId) throw new Error("冻结计划缺少删除批次标记");
  for (const pageId of operation.pageIds) {
    const deleted = await usePages
      .getState()
      .deletePage(pageId, { trashBatchId: deleteBatchId });
    if (!deleted) {
      const restoreErrors: string[] = [];
      for (const deletedRootId of [...deletedRootIds].reverse()) {
        const restored = usePages.getState().restorePage(deletedRootId);
        if (!restored.ok) restoreErrors.push(deletedRootId);
      }
      throw new Error(
        restoreErrors.length > 0
          ? `删除页面 ${pageId} 失败，且 ${restoreErrors.length} 个已删除页面未能恢复`
          : `删除页面 ${pageId} 失败，已恢复本项此前删除的页面`,
      );
    }
    deletedRootIds.push(pageId);
    for (const affectedPageId of affectedPageIds) {
      const page = usePages.getState().pages[affectedPageId];
      if (page)
        context.working = {
          ...context.working,
          after: {
            ...context.working.after,
            [affectedPageId]: revisionOf(page),
          },
        };
    }
  }
  affectedPageIds.forEach((pageId) =>
    useTabs.getState().removeDeletedPage(pageId),
  );
  result = {
    operationId: operation.operationId,
    type: operation.type,
    ok: true,
    pageIds: [...affectedPageIds],
  };
  return { result, recorded: false };
}
