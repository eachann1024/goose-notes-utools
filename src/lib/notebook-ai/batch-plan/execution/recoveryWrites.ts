import { usePages } from "@/stores/usePages";
import { getPageContentSignature } from "@/lib/notebook-ai/pageWriteGuard";
import { writeBatchPlanJournal } from "../journal";
import type { BatchPlanJournal, BatchPlanOperationInput } from "../types";
import {
  pageAtLocalPath,
  pathExists,
  comparisonPath,
  basenameWithoutMarkdownExtension,
} from "./paths";
import { plannedContent, plannedSearchReplaceContent } from "./content";
import { appendRecoveredSuccess, revisionOf, sameRevision } from "./snapshots";

export async function recoverCreateOperation(
  journal: BatchPlanJournal,
  operation: Extract<BatchPlanOperationInput, { type: "create" }>,
  operationId: string,
): Promise<BatchPlanJournal> {
  const plannedLocalPath = journal.plannedLocalPaths[operationId];
  const plannedPageId = journal.plannedPageIds[operationId];
  const page = plannedLocalPath
    ? pageAtLocalPath(plannedLocalPath)
    : plannedPageId
      ? usePages.getState().pages[plannedPageId]
      : undefined;
  if (!page)
    if (plannedLocalPath && (await pathExists(plannedLocalPath))) {
      return writeBatchPlanJournal({
        ...journal,
        status: "failed",
        error: "中断创建的本地文件已存在但尚未安全载入，已停止恢复",
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
    }
  if (!page)
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  const expected = getPageContentSignature(plannedContent(operation, journal));
  if (
    page.workspaceId !== journal.notebookId ||
    getPageContentSignature(page.content) !== expected
  ) {
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断创建页与冻结计划不一致，已停止恢复",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  return appendRecoveredSuccess(
    journal,
    { operationId, type: "create", ok: true, pageIds: [page.id] },
    { [page.id]: revisionOf(page) },
    page.id,
  );
}

export async function recoverEditOperation(
  journal: BatchPlanJournal,
  operation: Extract<BatchPlanOperationInput, { type: "edit" }>,
  operationId: string,
): Promise<BatchPlanJournal> {
  const page = usePages.getState().pages[operation.pageId];
  const before = journal.before[operation.pageId];
  if (!page || !before)
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断编辑的目标页不存在",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  const plannedLocalPath = journal.plannedLocalPaths[operationId];
  const currentPath = page.localFilePath;
  if (
    sameRevision(revisionOf(page), before.revision) &&
    (!plannedLocalPath ||
      comparisonPath(currentPath ?? "") ===
        comparisonPath(before.page.localFilePath ?? ""))
  )
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  const expected = getPageContentSignature(plannedContent(operation, journal));
  if (
    getPageContentSignature(page.content) === expected &&
    (!plannedLocalPath ||
      comparisonPath(currentPath ?? "") === comparisonPath(plannedLocalPath))
  ) {
    return appendRecoveredSuccess(
      currentPath
        ? {
            ...journal,
            localPathAfterByPageId: {
              ...journal.localPathAfterByPageId,
              [operation.pageId]: currentPath,
            },
          }
        : journal,
      { operationId, type: "edit", ok: true, pageIds: [operation.pageId] },
      { [operation.pageId]: revisionOf(page) },
    );
  }
  if (
    plannedLocalPath &&
    before.page.localFilePath &&
    sameRevision(revisionOf(page), before.revision) &&
    comparisonPath(currentPath ?? "") === comparisonPath(plannedLocalPath)
  ) {
    try {
      await usePages
        .getState()
        .renameLocalPageFile(
          operation.pageId,
          basenameWithoutMarkdownExtension(before.page.localFilePath),
        );
      return writeBatchPlanJournal({
        ...journal,
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
    } catch {
      // 继续走失败分支，避免覆盖无法证明状态的本地文件。
    }
  }
  return writeBatchPlanJournal({
    ...journal,
    status: "failed",
    error: "中断编辑后的内容与冻结计划不一致，已停止恢复",
    executingOperationId: undefined,
    executingStartedAt: undefined,
  });
}

export async function recoverSearchReplaceOperation(
  journal: BatchPlanJournal,
  operation: Extract<BatchPlanOperationInput, { type: "search_replace" }>,
  operationId: string,
): Promise<BatchPlanJournal> {
  const page = usePages.getState().pages[operation.pageId];
  const before = journal.before[operation.pageId];
  if (!page || !before)
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断局部替换的目标页不存在",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  if (sameRevision(revisionOf(page), before.revision)) {
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  try {
    const expected = getPageContentSignature(
      plannedSearchReplaceContent(operation, journal),
    );
    if (getPageContentSignature(page.content) === expected) {
      return appendRecoveredSuccess(
        page.localFilePath
          ? {
              ...journal,
              localPathAfterByPageId: {
                ...journal.localPathAfterByPageId,
                [operation.pageId]: page.localFilePath,
              },
            }
          : journal,
        {
          operationId,
          type: "search_replace",
          ok: true,
          pageIds: [operation.pageId],
        },
        { [operation.pageId]: revisionOf(page) },
      );
    }
  } catch {
    // fall through to failed
  }
  return writeBatchPlanJournal({
    ...journal,
    status: "failed",
    error: "中断局部替换后的内容与冻结计划不一致，已停止恢复",
    executingOperationId: undefined,
    executingStartedAt: undefined,
  });
}
