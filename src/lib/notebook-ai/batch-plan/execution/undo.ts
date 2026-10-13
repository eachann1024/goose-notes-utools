import { usePages } from "@/stores/usePages";
import { formatBatchPlanErrors } from "@/lib/notebook-ai/errors";
import { readBatchPlanJournal, writeBatchPlanJournal } from "../journal";
import type { BatchPlanExecuteResult } from "../types";
import { sameRevision, revisionOf } from "./snapshots";
import { comparisonPath, pathExists } from "./paths";
import { compensate } from "./compensate";

export async function undoBatchPlan(
  toolCallId: string,
  runId: string,
): Promise<BatchPlanExecuteResult> {
  const journal = readBatchPlanJournal(toolCallId, runId);
  if (!journal) throw new Error("未找到批量计划");
  if (journal.status === "undone")
    return { ok: true, journal, results: journal.results };
  if (journal.status !== "completed")
    return {
      ok: false,
      journal,
      error: "只有已完成的批量计划可以撤回",
      results: journal.results,
    };
  for (const [pageId, after] of Object.entries(journal.after)) {
    const page = usePages.getState().pages[pageId];
    if (!page || !sameRevision(revisionOf(page), after)) {
      const conflicted = writeBatchPlanJournal({
        ...journal,
        status: "undo-conflicted",
        error: "页面在批量执行后已被修改，拒绝覆盖",
      });
      return {
        ok: false,
        journal: conflicted,
        error: conflicted.error!,
        results: conflicted.results,
      };
    }
  }
  for (const [pageId, expectedPath] of Object.entries(
    journal.localPathAfterByPageId,
  )) {
    const currentPath = usePages.getState().pages[pageId]?.localFilePath;
    if (
      !currentPath ||
      comparisonPath(currentPath) !== comparisonPath(expectedPath)
    ) {
      const conflicted = writeBatchPlanJournal({
        ...journal,
        status: "undo-conflicted",
        error: "本地文件路径在批量执行后已变化，拒绝覆盖",
      });
      return {
        ok: false,
        journal: conflicted,
        error: conflicted.error!,
        results: conflicted.results,
      };
    }
  }
  const successfulLocalDeletePageIds = new Set(
    journal.results.flatMap((result) =>
      result.ok && result.type === "delete" ? result.pageIds : [],
    ),
  );
  for (const [pageId, trashPath] of Object.entries(
    journal.localTrashPathsByPageId,
  ).filter(([pageId]) => successfulLocalDeletePageIds.has(pageId))) {
    const originalPath = journal.before[pageId]?.page.localFilePath;
    if (
      !originalPath ||
      (await pathExists(originalPath)) ||
      !(await pathExists(trashPath))
    ) {
      const conflicted = writeBatchPlanJournal({
        ...journal,
        status: "undo-conflicted",
        error: "本地删除文件的恢复路径已变化，拒绝覆盖",
      });
      return {
        ok: false,
        journal: conflicted,
        error: conflicted.error!,
        results: conflicted.results,
      };
    }
  }
  const compensationErrors = await compensate(journal);
  if (compensationErrors.length > 0) {
    const conflicted = writeBatchPlanJournal({
      ...journal,
      status: "undo-conflicted",
      error: formatBatchPlanErrors(compensationErrors),
    });
    return {
      ok: false,
      journal: conflicted,
      error: conflicted.error!,
      results: conflicted.results,
    };
  }
  const undone = writeBatchPlanJournal({
    ...journal,
    status: "undone",
    error: undefined,
  });
  return { ok: true, journal: undone, results: undone.results };
}
