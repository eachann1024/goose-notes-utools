import { useEffect } from "react";
import { setPageMentionOpenHandler } from "@/components/editor/inline/pageMentionBridge";
import {
  clearEditorSelectedBlocksCache,
  readLiveEditorSelectedBlocks,
  rememberEditorSelectedBlocks,
} from "./EditorComposer";
import type { RefObject } from "react";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorInstance } from "./editorTypes";

export function useEditorSelection({
  isActiveEditor,
  editor,
  onOpenPageRef,
}: {
  isActiveEditor: boolean;
  editor: EditorInstance;
  onOpenPageRef: RefObject<EditorPageContext["onOpenPage"]>;
}) {
  useEffect(() => {
    if (!isActiveEditor) return;
    (window as any).__gooseNoteEditor = editor;
    setPageMentionOpenHandler((pageId, wikiTarget, options) => onOpenPageRef.current(pageId, wikiTarget, options));
    const rememberLiveSelection = () => {
      rememberEditorSelectedBlocks(editor);
    };
    const syncSelectionCacheAfterPointer = (event: Event) => {
      const target = event.target;
      const insideEditor = target instanceof Node && Boolean(editor.domElement?.contains(target));
      if (!insideEditor) return;
      const live = readLiveEditorSelectedBlocks(editor);
      if (live.length > 0) {
        rememberEditorSelectedBlocks(editor);
        return;
      }
      clearEditorSelectedBlocksCache(editor);
    };
    document.addEventListener("selectionchange", rememberLiveSelection);
    document.addEventListener("pointerup", syncSelectionCacheAfterPointer, true);
    return () => {
      document.removeEventListener("selectionchange", rememberLiveSelection);
      document.removeEventListener("pointerup", syncSelectionCacheAfterPointer, true);
      if ((window as any).__gooseNoteEditor === editor) {
        (window as any).__gooseNoteEditor = null;
      }
      setPageMentionOpenHandler(null);
      clearEditorSelectedBlocksCache(editor);
    };
  }, [editor, isActiveEditor]);
}
