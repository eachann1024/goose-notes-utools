import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { EditorSettings } from "@/components/editor/platform/hostContext";

export function useCodeBlockEdit({
  block,
  contentRef,
  editor,
  onDefaultCodeBlockWrapChange,
  summaryDraft,
  summary,
  setSummaryDraft,
  setIsEditingSummary,
  collapsed,
}: {
  block: any;
  contentRef: any;
  editor: any;
  onDefaultCodeBlockWrapChange: EditorSettings["onDefaultCodeBlockWrapChange"];
  summaryDraft: string;
  summary: string;
  setSummaryDraft: Dispatch<SetStateAction<string>>;
  setIsEditingSummary: Dispatch<SetStateAction<boolean>>;
  collapsed: boolean;
}) {
  const getCodeContent = useCallback(() => {
    const content = block.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((c: any) => c?.text ?? "").join("");
    }
    // Walk inline content via DOM
    const el = contentRef.current;
    if (el) return el.textContent || "";
    return "";
  }, [block.content, contentRef]);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      editor.updateBlock(block.id, { props: { language: lang } });
    },
    [editor, block.id],
  );

  const handleWrapChange = useCallback(
    (w: boolean) => {
      onDefaultCodeBlockWrapChange(w);
      editor.updateBlock(block.id, { props: { wrap: w } });
    },
    [editor, block.id, onDefaultCodeBlockWrapChange],
  );

  const normalizeSummary = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

  const handleSummaryCommit = useCallback(() => {
    const next = normalizeSummary(summaryDraft);
    if (next !== summary) {
      editor.updateBlock(block.id, { props: { summary: next } });
    }
    setSummaryDraft(next);
    setIsEditingSummary(false);
  }, [summaryDraft, summary, editor, block.id]);

  const handleCollapsedChange = useCallback(() => {
    editor.updateBlock(block.id, { props: { collapsed: !collapsed } });
  }, [editor, block.id, collapsed]);

  const handleFormat = useCallback(
    (formatted: string) => {
      // BlockNote: update block content by replacing all text
      const currentContent = block.content;
      if (Array.isArray(currentContent) && currentContent.length > 0) {
        editor.updateBlock(block.id, {
          content: [{ type: "text", text: formatted, styles: {} }],
        });
      }
    },
    [editor, block.id, block.content],
  );

  const insertTextAtCursor = useCallback((text: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLPreElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        insertTextAtCursor(text.replace(/\r\n/g, "\n"));
      }
    },
    [insertTextAtCursor],
  );
  return {
    getCodeContent,
    handleLanguageChange,
    handleWrapChange,
    handleSummaryCommit,
    handleCollapsedChange,
    handleFormat,
    handlePaste,
  };
}
