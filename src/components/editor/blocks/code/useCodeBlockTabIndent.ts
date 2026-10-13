import { useCallback, useEffect } from "react";
import { indentCodeSelection } from "./codeBlockIndent";
import type { RefObject } from "react";
import { getCodeDomSelection, isComposingKeyboardEvent, setCodeDomSelectionOffsets } from "./codeDomSelection";

export function useCodeBlockTabIndent({
  isEditable,
  rootRef,
  editor,
  block,
}: {
  isEditable: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  editor: any;
  block: any;
}) {
  useEffect(() => {
    if (!isEditable) return;

    const applyTabIndent = (event: KeyboardEvent | React.KeyboardEvent) => {
      if (event.key !== "Tab" || isComposingKeyboardEvent(event)) return;
      const domSelection = getCodeDomSelection();
      if (!domSelection || !rootRef.current?.contains(domSelection.codeElement)) return;

      const next = indentCodeSelection(domSelection.text, domSelection.start, domSelection.end, {
        outdent: event.shiftKey,
      });
      event.preventDefault();
      event.stopPropagation();
      editor.updateBlock(block.id, { content: next.text });
      window.requestAnimationFrame(() => {
        const codeElement = rootRef.current?.querySelector<HTMLElement>(".goose-code-content");
        if (codeElement) {
          setCodeDomSelectionOffsets(codeElement, next.selectionStart, next.selectionEnd);
        }
      });
      if ("stopImmediatePropagation" in event) {
        event.stopImmediatePropagation();
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      applyTabIndent(event);
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      applyTabIndent(event);
    };

    window.addEventListener("keydown", handleWindowKeyDown, true);
    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
    };
  }, [block.id, editor, isEditable]);

  const handleCodeKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab" || isComposingKeyboardEvent(event) || !isEditable) return;
      const domSelection = getCodeDomSelection();
      if (!domSelection || !rootRef.current?.contains(domSelection.codeElement)) return;

      const next = indentCodeSelection(domSelection.text, domSelection.start, domSelection.end, {
        outdent: event.shiftKey,
      });
      event.preventDefault();
      event.stopPropagation();
      editor.updateBlock(block.id, { content: next.text });
      window.requestAnimationFrame(() => {
        const codeElement = rootRef.current?.querySelector<HTMLElement>(".goose-code-content");
        if (codeElement) {
          setCodeDomSelectionOffsets(codeElement, next.selectionStart, next.selectionEnd);
        }
      });
    },
    [block.id, editor, isEditable],
  );
  return { handleCodeKeyDownCapture };
}
