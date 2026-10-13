import { useEffect } from "react";
import {
  reconcilePageMentionSuggestionMenu,
  reconcileSlashSuggestionMenu,
} from "@/components/editor/utils/slashMenuPolicy";
import type { RefObject } from "react";
import type { EditorInstance } from "./editorTypes";

export function useEditorComposition({
  editorContainerRef,
  editor,
  usesRawEditorContentRef,
}: {
  editorContainerRef: RefObject<HTMLDivElement | null>;
  editor: EditorInstance;
  usesRawEditorContentRef: RefObject<boolean>;
}) {
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    const onCompositionEnd = () =>
      queueMicrotask(() => {
        reconcileSlashSuggestionMenu(editor, {
          allowSlashMenuOnFirstBlock: usesRawEditorContentRef.current,
        });
        reconcilePageMentionSuggestionMenu(editor);
      });
    container.addEventListener("compositionend", onCompositionEnd);
    return () => container.removeEventListener("compositionend", onCompositionEnd);
  }, [editor]);
}
