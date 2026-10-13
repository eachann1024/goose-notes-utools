import { useCallback } from "react";
import { applyAISelection } from "./aiSelectionBridge";
import type { EditorCommand, NativeAISelectionReplacement } from "./types";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorCommands({
  matchesCurrentEnvelope,
  modeRef,
  editorRef,
}: Pick<NativeEditorBindings, "matchesCurrentEnvelope" | "modeRef" | "editorRef">) {

  const dispatchCommand = useCallback(
    (command: EditorCommand) => {
      if (!matchesCurrentEnvelope(command) || modeRef.current !== "blocks")
        return;
      const editor = editorRef.current?.editor;
      if (!editor) return;
      const cursor = editor.getTextCursorPosition();
      const selectedBlocks = editor.getSelection()?.blocks ?? [cursor.block];
      const setTextAlignment = (alignment: "left" | "center" | "right") => {
        editor.transact(() => {
          for (const block of selectedBlocks) {
            editor.updateBlock(block, { props: { textAlignment: alignment } });
          }
        });
      };
      const clearFormatting = () => {
        // removeStyles 会经 Tiptap 立即派发事务；不能包在 BlockNote transact 内，
        // 否则后续对齐更新会复用已提交的事务而触发 mismatched transaction。
        editor.removeStyles({
          bold: true,
          italic: true,
          underline: true,
          strike: true,
          code: true,
          textColor: true,
          backgroundColor: true,
        });
        const blocksToReset = editor.getSelection()?.blocks ?? [
          editor.getTextCursorPosition().block,
        ];
        editor.transact(() => {
          for (const block of blocksToReset) {
            editor.updateBlock(block, { props: { textAlignment: "left" } });
          }
        });
      };
      switch (command.name) {
        case "bold":
          editor.toggleStyles({ bold: true });
          break;
        case "italic":
          editor.toggleStyles({ italic: true });
          break;
        case "underline":
          editor.toggleStyles({ underline: true });
          break;
        case "strike":
          editor.toggleStyles({ strike: true });
          break;
        case "code":
          editor.toggleStyles({ code: true });
          break;
        case "heading1":
          editor.updateBlock(cursor.block, {
            type: "heading",
            props: { level: 1 },
          });
          break;
        case "heading2":
          editor.updateBlock(cursor.block, {
            type: "heading",
            props: { level: 2 },
          });
          break;
        case "heading3":
          editor.updateBlock(cursor.block, {
            type: "heading",
            props: { level: 3 },
          });
          break;
        case "bulletList":
          editor.updateBlock(cursor.block, { type: "bulletListItem" });
          break;
        case "numberedList":
          editor.updateBlock(cursor.block, { type: "numberedListItem" });
          break;
        case "checkList":
          editor.updateBlock(cursor.block, { type: "checkListItem" });
          break;
        case "blockquote":
          editor.updateBlock(cursor.block, { type: "quote" });
          break;
        case "alignLeft":
          setTextAlignment("left");
          break;
        case "alignCenter":
          setTextAlignment("center");
          break;
        case "alignRight":
          setTextAlignment("right");
          break;
        case "clearFormatting":
          clearFormatting();
          break;
        case "find":
          window.dispatchEvent(new CustomEvent("goose-note:editor-find-open"));
          break;
        case "findNext":
        case "findPrevious":
          window.dispatchEvent(new CustomEvent("goose-note:editor-find-open"));
          window.dispatchEvent(
            new CustomEvent("goose-note:editor-find-nav", {
              detail: {
                direction: command.name === "findNext" ? "next" : "previous",
              },
            }),
          );
          break;
        case "link": {
          document.activeElement?.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              bubbles: true,
            }),
          );
          break;
        }
        default:
          break;
      }
    },
    [matchesCurrentEnvelope],
  );

  const applyNativeAISelection = useCallback(
    (replacement: NativeAISelectionReplacement) => {
      if (!matchesCurrentEnvelope(replacement) || modeRef.current !== "blocks")
        return false;
      const editor = editorRef.current?.editor;
      return editor ? applyAISelection(editor, replacement) : false;
    },
    [matchesCurrentEnvelope],
  );

  return { dispatchCommand, applyNativeAISelection };
}
