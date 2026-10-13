import { createExtension } from "@blocknote/core";
import { Plugin } from "prosemirror-state";
import { indentCodeSelection } from "./codeBlockIndent";
import { getCodeDomSelection } from "./codeDomSelection";
import { applyCodeBlockIndentTransaction } from "./codeIndentTransaction";

export const codeBlockTabIndentExtension = createExtension(({ editor }) => ({
  key: "goose-code-block-tab-indent",
  runsBefore: ["code-block-keyboard-shortcuts"],
  mount: ({ dom, root, signal }) => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.isComposing) return;
      const domSelection = getCodeDomSelection();
      if (!domSelection) return;
      const { block } = editor.getTextCursorPosition();
      if (block.type !== "codeBlock") return;

      const next = indentCodeSelection(domSelection.text, domSelection.start, domSelection.end, {
        outdent: event.shiftKey,
      });
      editor.updateBlock(block.id, { content: next.text } as any);

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const target = root instanceof Document ? root : dom.ownerDocument;
    target.addEventListener("keydown", handleKeyDown, {
      capture: true,
      signal,
    });
  },
  keyboardShortcuts: {
    Tab: ({ editor }) => editor.transact((tr) => applyCodeBlockIndentTransaction(tr, false)),
    "Shift-Tab": ({ editor }) => editor.transact((tr) => applyCodeBlockIndentTransaction(tr, true)),
  },
  prosemirrorPlugins: [
    new Plugin({
      props: {
        handleKeyDown(view, event) {
          if (event.key !== "Tab" || event.isComposing || !view.editable) {
            return false;
          }

          const { state, dispatch } = view;
          const tr = state.tr;
          if (!applyCodeBlockIndentTransaction(tr, event.shiftKey)) {
            return false;
          }

          event.preventDefault();
          dispatch(tr);
          return true;
        },
      },
    }),
  ],
}))();
