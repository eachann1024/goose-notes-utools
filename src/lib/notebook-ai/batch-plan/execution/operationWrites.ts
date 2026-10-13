import { usePages } from "@/stores/usePages";
import { writePageContentSafely } from "@/lib/notebook-ai/pageWriteGuard";
import { reloadEditorIfActive } from "@/lib/notebook-ai/liveWriter";
import type { BatchOperationResult, BatchPlanOperationInput } from "../types";
import type {
  BatchOperationContext,
  BatchOperationExecution,
} from "./operationTypes";
import { plannedContent, writeSearchReplaceFromLatest } from "./content";
import { comparisonPath, basenameWithoutMarkdownExtension } from "./paths";
import { revisionOf, rememberBefore, pendingOperations } from "./snapshots";

export async function runCreateOperation(
  operation: Extract<BatchPlanOperationInput, { type: "create" }>,
  context: BatchOperationContext,
): Promise<BatchOperationExecution> {
  let result: BatchOperationResult;
  const content = plannedContent(operation, context.working);
  const plannedLocalPath =
    context.working.plannedLocalPaths[operation.operationId];
  let pageId: string;
  if (plannedLocalPath) {
    const created = await usePages.getState().createLocalPageRecord({
      workspaceId: context.working.notebookId,
      parentId: operation.parentId,
      title: operation.title,
      content,
      filePath: plannedLocalPath,
    });
    if (!created) throw new Error("创建本地文件页面失败");
    pageId = created;
    const actualPath = usePages.getState().pages[pageId]?.localFilePath;
    if (
      !actualPath ||
      comparisonPath(actualPath) !== comparisonPath(plannedLocalPath)
    ) {
      await usePages.getState().deletePage(pageId);
      throw new Error("本地新建目标在执行时发生变化，已取消创建");
    }
  } else {
    pageId = context.working.plannedPageIds[operation.operationId];
    if (!pageId) throw new Error("冻结计划缺少预分配页面 ID");
    if (usePages.getState().pages[pageId]) {
      throw new Error("预分配页面 ID 已存在，拒绝重复创建");
    }
    const created = usePages.getState().createPageRecord({
      id: pageId,
      workspaceId: context.working.notebookId,
      parentId: operation.parentId,
      content,
    });
    if (created !== pageId) throw new Error("创建页面返回了非预分配 ID");
  }
  const page = usePages.getState().pages[pageId];
  if (!page) throw new Error("创建页面后未找到页面");
  context.working = {
    ...context.working,
    createdPageIds: {
      ...context.working.createdPageIds,
      [operation.operationId]: pageId,
    },
    after: { ...context.working.after, [pageId]: revisionOf(page) },
  };
  result = {
    operationId: operation.operationId,
    type: operation.type,
    ok: true,
    pageIds: [pageId],
  };
  return { result, recorded: false };
}

export async function runEditOperation(
  operation: Extract<BatchPlanOperationInput, { type: "edit" }>,
  context: BatchOperationContext,
): Promise<BatchOperationExecution> {
  let result: BatchOperationResult;
  await rememberBefore(operation.pageId, context.working);
  const before = context.working.before[operation.pageId];
  const originalPath = before.page.localFilePath;
  const plannedLocalPath =
    context.working.plannedLocalPaths[operation.operationId];
  let renamed = false;
  if (
    originalPath &&
    plannedLocalPath &&
    comparisonPath(originalPath) !== comparisonPath(plannedLocalPath)
  ) {
    const renamedPageId = await usePages
      .getState()
      .renameLocalPageFile(
        operation.pageId,
        basenameWithoutMarkdownExtension(plannedLocalPath),
      );
    const actualPath = usePages.getState().pages[renamedPageId]?.localFilePath;
    if (
      !actualPath ||
      comparisonPath(actualPath) !== comparisonPath(plannedLocalPath)
    ) {
      if (actualPath && originalPath) {
        try {
          await usePages
            .getState()
            .renameLocalPageFile(
              operation.pageId,
              basenameWithoutMarkdownExtension(originalPath),
            );
        } catch {
          // 保留失败现场，由执行日志提示人工恢复。
        }
      }
      throw new Error("本地文件重命名结果与审批计划不一致");
    }
    renamed = true;
  }
  const saved = await writePageContentSafely(
    operation.pageId,
    plannedContent(operation, context.working),
    {
      expectedNotebookId: context.working.notebookId,
      expectedRevision: before.revision,
    },
  );
  if (!saved.ok) {
    if (renamed && originalPath) {
      await usePages
        .getState()
        .renameLocalPageFile(
          operation.pageId,
          basenameWithoutMarkdownExtension(originalPath),
        );
    }
    throw new Error(saved.error);
  }
  const page = usePages.getState().pages[operation.pageId]!;
  context.working = {
    ...context.working,
    after: { ...context.working.after, [operation.pageId]: revisionOf(page) },
    localPathAfterByPageId: page.localFilePath
      ? {
          ...context.working.localPathAfterByPageId,
          [operation.pageId]: page.localFilePath,
        }
      : context.working.localPathAfterByPageId,
  };
  reloadEditorIfActive(operation.pageId);
  result = {
    operationId: operation.operationId,
    type: operation.type,
    ok: true,
    pageIds: [operation.pageId],
  };
  return { result, recorded: false };
}

export async function runSearchReplaceOperation(
  operation: Extract<BatchPlanOperationInput, { type: "search_replace" }>,
  context: BatchOperationContext,
): Promise<BatchOperationExecution> {
  let result: BatchOperationResult;
  await rememberBefore(operation.pageId, context.working);
  await writeSearchReplaceFromLatest(operation, context.working);
  const page = usePages.getState().pages[operation.pageId]!;
  context.working = {
    ...context.working,
    after: { ...context.working.after, [operation.pageId]: revisionOf(page) },
    localPathAfterByPageId: page.localFilePath
      ? {
          ...context.working.localPathAfterByPageId,
          [operation.pageId]: page.localFilePath,
        }
      : context.working.localPathAfterByPageId,
  };
  const nextSamePage = pendingOperations(context.working).some(
    (candidate) =>
      candidate.operationId !== operation.operationId &&
      candidate.type === "search_replace" &&
      candidate.pageId === operation.pageId &&
      !context.working.results.some(
        (item) => item.operationId === candidate.operationId && item.ok,
      ),
  );
  // 同页后续项还要写：先不刷新编辑器，避免中间修订把后面的项卡死。
  if (!nextSamePage) reloadEditorIfActive(operation.pageId);
  result = {
    operationId: operation.operationId,
    type: operation.type,
    ok: true,
    pageIds: [operation.pageId],
  };
  return { result, recorded: false };
}
