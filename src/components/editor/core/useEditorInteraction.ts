import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { markUserInteraction } from "@/lib/editor-interaction-signal";
import { rememberEditorSelectedBlocks } from "./EditorComposer";
import type { RefObject } from "react";

export function useEditorInteraction({
  userInteractedRef,
  editorInstanceRef,
}: {
  userInteractedRef: RefObject<boolean>;
  editorInstanceRef: RefObject<ReturnType<typeof useCreateBlockNote> | null>;
}) {
  useEffect(() => {
    const markInteracted = (event: Event) => {
      userInteractedRef.current = true;
      markUserInteraction();
      const currentEditor = editorInstanceRef.current;
      if (!currentEditor || event.type !== "pointerdown") return;
      const target = event.target;
      const insideEditor = target instanceof Node && Boolean(currentEditor.domElement?.contains(target));
      if (insideEditor) return;
      rememberEditorSelectedBlocks(currentEditor);
    };
    const events = ["pointerdown", "keydown", "paste", "cut", "drop"] as const;
    events.forEach((name) => document.addEventListener(name, markInteracted, true));
    return () => events.forEach((name) => document.removeEventListener(name, markInteracted, true));
  }, []);
}
