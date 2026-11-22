import { useEffect, useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { isFoldableHeadingBlock } from "@/components/editor/core/headingSectionFold";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  isCollapsed: boolean;
  isEditorFoldable: boolean;
  children: HeadingItem[];
}

function extractTextFromBlock(block: any): string {
  if (!block.content) return "";
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((inline: any) => {
        if (typeof inline === "string") return inline;
        if (inline?.text) return inline.text;
        return "";
      })
      .join("");
  }
  return "";
}

function collectHeadings(doc: any[]): HeadingItem[] {
  const roots: HeadingItem[] = [];
  const stack: HeadingItem[] = [];
  const firstBlockId = doc[0]?.id as string | undefined;

  const visit = (block: any) => {
    if (block.type === "heading" && block.props?.level) {
      const level = block.props.level;
      // 仅记录 h1-h4
      if (level >= 2 && level <= 4) {
        const item: HeadingItem = {
          id: block.id,
          level,
          text: extractTextFromBlock(block) || "无标题",
          // 标题折叠的唯一数据来源是 BlockNote heading.props.collapsed。
          // 兼容旧内容可能留下的字符串值，和编辑器折叠扩展保持一致。
          isCollapsed:
            block.props?.collapsed === true || block.props?.collapsed === "true",
          isEditorFoldable: isFoldableHeadingBlock(block, firstBlockId),
          children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(item);
        } else {
          roots.push(item);
        }
        stack.push(item);
      }
    }
    if (block.children?.length) {
      for (const child of block.children) visit(child);
    }
  };

  for (const block of doc) visit(block);
  return roots;
}

function headingsEqual(left: HeadingItem[], right: HeadingItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((heading, index) => {
    const other = right[index];
    return (
      heading.id === other.id &&
      heading.level === other.level &&
      heading.text === other.text &&
      heading.isCollapsed === other.isCollapsed &&
      heading.isEditorFoldable === other.isEditorFoldable &&
      headingsEqual(heading.children, other.children)
    );
  });
}

export function useHeadings(
  editor: BlockNoteEditor | null,
  enabled: boolean,
  pageId?: string | null,
) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    if (!editor) {
      setHeadings((current) => (current.length ? [] : current));
      return;
    }

    const refresh = () => {
      const nextHeadings = collectHeadings(editor.document);
      setHeadings((current) =>
        headingsEqual(current, nextHeadings) ? current : nextHeadings,
      );
    };
    let frame: number | null = null;
    const scheduleRefresh = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!editor.prosemirrorView?.composing) refresh();
      });
    };
    const unsubscribe = editor.onChange(() => {
      if (!editor.prosemirrorView?.composing) scheduleRefresh();
    });
    const dom = editor.prosemirrorView?.dom;
    dom?.addEventListener("compositionend", scheduleRefresh);
    refresh();

    return () => {
      unsubscribe?.();
      dom?.removeEventListener("compositionend", scheduleRefresh);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [editor, enabled, pageId]);

  return headings;
}
