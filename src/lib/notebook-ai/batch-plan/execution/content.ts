import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  buildAiPageContent,
  normalizeAiMarkdown,
  parseAiMarkdownToBlocks,
} from "@/lib/notebook-ai/markdown";
import { normalizePageContent } from "@/components/editor/utils/blocknote-content";
import {
  getPageTitle,
  withInternalPageTitle,
} from "@/components/editor/utils/page-title";
import { writePageContentSafely } from "@/lib/notebook-ai/pageWriteGuard";
import type { JSONContent } from "@/types";
import {
  applySearchReplacePreservingBlocks,
  mergeFullEditPreservingUnchangedBlocks,
} from "../surgicalApply";
import type { BatchPlanInput, BatchPlanJournal } from "../types";
import { revisionOf } from "./snapshots";

export function plannedContent(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "create" | "edit" }
  >,
  journal: BatchPlanJournal,
) {
  if (operation.type === "create") {
    const isLocal =
      useNotebooks.getState().notebooks[journal.notebookId]?.source ===
      "local-folder";
    if (isLocal) {
      const content = parseAiMarkdownToBlocks(operation.markdown);
      return normalizePageContent(content, {
        ensureFirstTitle: false,
      }) as JSONContent;
    }
    return buildAiPageContent(operation.title, operation.markdown);
  }

  // full edit：用块级 merge 保留未改动块的 id / props
  const beforePage = journal.before[operation.pageId].page;
  const beforeContent = beforePage.content;
  const isLocal = Boolean(beforePage.localFilePath);
  if (isLocal) {
    return mergeFullEditPreservingUnchangedBlocks(
      beforeContent,
      normalizeAiMarkdown(operation.markdown),
      { ensureFirstTitle: false },
    ).content;
  }

  const title = operation.title?.trim() || getPageTitle(beforePage) || "无标题";
  const merged = mergeFullEditPreservingUnchangedBlocks(
    beforeContent,
    normalizeAiMarkdown(operation.markdown),
    { ensureFirstTitle: true },
  );
  const blocks = Array.isArray(merged.content)
    ? merged.content
    : (merged.content as { content?: unknown } | null)?.content;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return buildAiPageContent(title, operation.markdown);
  }
  if (operation.title?.trim()) {
    return withInternalPageTitle(merged.content, title);
  }
  return merged.content;
}

export function plannedSearchReplaceContent(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "search_replace" }
  >,
  journal: BatchPlanJournal,
): JSONContent {
  const before = journal.before[operation.pageId];
  const applied = applySearchReplacePreservingBlocks(
    before.page.content,
    operation.oldString,
    operation.newString,
    { replaceAll: operation.replaceAll === true },
  );
  if (!applied.ok) throw new Error(applied.error);
  return applied.content;
}

export async function writeSearchReplaceFromLatest(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "search_replace" }
  >,
  working: BatchPlanJournal,
) {
  const before = working.before[operation.pageId];
  if (!before) throw new Error("冻结计划缺少目标页面快照");

  const attempt = async () => {
    const livePage = usePages.getState().pages[operation.pageId];
    if (!livePage) throw new Error("目标页不存在");
    const alreadyWrote = Boolean(working.after[operation.pageId]);
    // 同页后续项必须基于当前正文和当前修订，不能再用批准瞬间的旧快照。
    const baseContent = alreadyWrote ? livePage.content : before.page.content;
    const expectedRevision = alreadyWrote
      ? revisionOf(livePage)
      : before.revision;
    const applied = applySearchReplacePreservingBlocks(
      baseContent,
      operation.oldString,
      operation.newString,
      { replaceAll: operation.replaceAll === true },
    );
    if (!applied.ok) throw new Error(applied.error);
    const saved = await writePageContentSafely(
      operation.pageId,
      applied.content,
      {
        expectedNotebookId: working.notebookId,
        expectedRevision,
      },
    );
    return saved;
  };

  let saved = await attempt();
  if (
    !saved.ok &&
    saved.code === "page-changed" &&
    working.after[operation.pageId]
  ) {
    saved = await attempt();
  }
  if (!saved.ok) throw new Error(saved.error);
}
