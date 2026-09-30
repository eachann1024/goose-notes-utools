import {
  blockToNode,
  nodeToBlock,
  type BlockNoteEditor,
} from "@blocknote/core";
import type { Fragment } from "prosemirror-model";
import {
  captureInlineSelection,
  composeInlineReplacement,
  type InlineSelectionSnapshot,
} from "@/components/editor/ai/selectionPrivacy";
import { normalizeAiMarkdown } from "./markdown";
import { inheritPresentationFromSource } from "./inheritPresentation";
import {
  parseMarkdownToBlocks,
  serializeBlocksToMarkdown,
} from "./inlineMarkdownApply";

// The editor's public conversion functions accept custom BlockNote schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = BlockNoteEditor<any, any, any>;
export interface PrivateInlineTarget extends InlineSelectionSnapshot {
  oldMarkdown: string;
  sourceBlockIds: string[];
}

export function capturePrivateInlineTarget(
  editor: Editor,
  blockId: string,
): PrivateInlineTarget {
  const { doc, selection } = editor.prosemirrorState;
  let { from, to } = selection;
  if (selection.empty) {
    let found = false;
    doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name !== "blockContainer" || node.attrs.id !== blockId)
        return true;
      if (!node.firstChild?.isTextblock)
        throw new Error("当前块不支持行内文字改写。");
      from = pos + 2;
      to = from + node.firstChild.content.size;
      found = true;
      return false;
    });
    if (!found) throw new Error("目标块已不在文档中，请重新选择。");
  }
  const target = captureInlineSelection(doc, from, to);
  const blocks = target.selectedNodes.map((node) =>
    nodeToBlock(
      node,
      editor.prosemirrorState.schema,
      editor.schema.blockSchema,
      editor.schema.inlineContentSchema,
      editor.schema.styleSchema,
    ),
  );
  return {
    ...target,
    sourceBlockIds: target.sourceNodes.map((node) => String(node.attrs.id)),
    oldMarkdown: serializeBlocksToMarkdown(editor, blocks),
  };
}

export function preparePrivateInlineDraft(
  editor: Editor,
  target: PrivateInlineTarget,
  markdown: string,
): Fragment {
  const normalized = normalizeAiMarkdown(markdown).trim();
  if (!normalized) throw new Error("AI 未返回可写入的内容。");
  const source = target.sourceBlockIds.map((id) => editor.getBlock(id));
  const parsed = inheritPresentationFromSource(
    source,
    parseMarkdownToBlocks(editor, normalized),
  );
  const nodes = parsed.map((block) =>
    blockToNode(
      withoutIds(block) as Parameters<typeof blockToNode>[0],
      editor.prosemirrorState.schema,
      editor.schema.styleSchema,
    ),
  );
  return composeInlineReplacement(target, nodes);
}

export function assertPrivateInlineTarget(
  editor: Editor,
  target: PrivateInlineTarget,
): void {
  if (!editor.isEditable) throw new Error("当前页面不可编辑。");
  if (
    !editor.prosemirrorState.doc.eq(target.document) ||
    target.sourceBlockIds.some((id) => !editor.getBlock(id))
  ) {
    throw new Error("原文已变化，请关闭菜单并重新选择后重试。");
  }
}

export function applyPrivateInlineDraft(
  editor: Editor,
  target: PrivateInlineTarget,
  draft: Fragment,
): void {
  assertPrivateInlineTarget(editor, target);
  // One transaction, only after acceptance. Rejection never needs undo/restore.
  editor.transact((tr) =>
    tr.replaceWith(target.replaceFrom, target.replaceTo, draft),
  );
}

function withoutIds(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const { id: _id, ...block } = value as Record<string, unknown>;
  if (Array.isArray(block.children))
    block.children = block.children.map(withoutIds);
  return block;
}
