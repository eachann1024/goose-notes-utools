import { getPageContentSignature } from "@/lib/notebook-ai/pageWriteGuard";
import { recordHistorySnapshot } from "@/lib/history/snapshot";
import { writeBatchPlanJournal } from "../journal";
import type {
  BatchOperationResult,
  BatchPlanJournal,
  PageRevision,
} from "../types";

export function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function revisionOf(page: {
  updatedAt: number;
  content: unknown;
}): PageRevision {
  return {
    updatedAt: page.updatedAt,
    contentSignature: getPageContentSignature(page.content),
  };
}

export function sameRevision(current: PageRevision, expected: PageRevision) {
  return (
    current.updatedAt === expected.updatedAt &&
    current.contentSignature === expected.contentSignature
  );
}

export function selectedOperations(journal: BatchPlanJournal) {
  const selected = new Set(journal.selectedOperationIds);
  return journal.input.operations.filter((operation) =>
    selected.has(operation.operationId),
  );
}

export function successfulOperationIds(journal: BatchPlanJournal) {
  return new Set(
    journal.results
      .filter((result) => result.ok)
      .map((result) => result.operationId),
  );
}

export function pendingOperations(journal: BatchPlanJournal) {
  const completed = successfulOperationIds(journal);
  return selectedOperations(journal).filter(
    (operation) => !completed.has(operation.operationId),
  );
}

export function resultForOperation(
  journal: BatchPlanJournal,
  operationId: string,
) {
  return journal.results.find(
    (result) => result.operationId === operationId && result.ok,
  );
}

export function appendRecoveredSuccess(
  journal: BatchPlanJournal,
  result: BatchOperationResult,
  after: Record<string, PageRevision>,
  createdPageId?: string,
) {
  return writeBatchPlanJournal({
    ...journal,
    results: resultForOperation(journal, result.operationId)
      ? journal.results
      : [...journal.results, result],
    after: { ...journal.after, ...after },
    createdPageIds: createdPageId
      ? { ...journal.createdPageIds, [result.operationId]: createdPageId }
      : journal.createdPageIds,
    executingOperationId: undefined,
    executingStartedAt: undefined,
  });
}

export async function rememberBefore(
  pageId: string,
  journal: BatchPlanJournal,
) {
  const snapshot = journal.before[pageId];
  if (!snapshot) return;
  await recordHistorySnapshot({
    pageId,
    workspaceId: journal.notebookId,
    content: clone(snapshot.page.content),
    trigger: "pre-op",
    isMilestone: true,
    label: `AI 批量计划 ${journal.input.title} 前`,
  });
}
