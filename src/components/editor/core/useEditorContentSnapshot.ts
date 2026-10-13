import { useCallback, useMemo } from "react";
import { createDebounce } from "@/components/editor/utils/debounce";
import {
  clonePageContent,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import type { RefObject } from "react";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorInstance } from "./editorTypes";
import { getCachedContentSignature } from "./editorContentPolicy";

export function useEditorContentSnapshot({
  editor,
  contentModeRef,
  pageIdForUpdateRef,
  pendingEditorChangeRef,
  syncedContentSignatureRef,
  onContentChangeRef,
}: {
  editor: EditorInstance;
  contentModeRef: RefObject<EditorPageContext["contentMode"]>;
  pageIdForUpdateRef: RefObject<string | null>;
  pendingEditorChangeRef: RefObject<boolean>;
  syncedContentSignatureRef: RefObject<string | null>;
  onContentChangeRef: RefObject<EditorPageContext["onContentChange"]>;
}) {
  const readCurrentEditorContent = useCallback(() => {
    const rawContent = clonePageContent(editor.document as BlockNoteContent);
    const isLocalPage = contentModeRef.current === "raw";
    const content = isLocalPage ? rawContent : normalizePageContent(rawContent);
    return {
      content,
      signature: getCachedContentSignature(content),
    };
  }, [editor]);

  const debouncedUpdate = useMemo(() => {
    return createDebounce(
      (targetPageId: string) => {
        if (targetPageId !== pageIdForUpdateRef.current) return;
        const { content, signature } = readCurrentEditorContent();
        pendingEditorChangeRef.current = false;
        if (signature === syncedContentSignatureRef.current) return;
        syncedContentSignatureRef.current = signature;
        onContentChangeRef.current(content);
      },
      800,
      { maxWait: 3000 },
    );
  }, [readCurrentEditorContent]);
  return { readCurrentEditorContent, debouncedUpdate };
}
