import type { BlockNoteEditor } from "@blocknote/core";
import { createExtension } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "prosemirror-state";

import {
  reconcilePageMentionSuggestionMenu,
  reconcileSlashSuggestionMenu,
  shouldOpenSlashSuggestionMenu,
  type SlashMenuPagePolicy,
} from "@/components/editor/utils/slashMenuPolicy";

const PLUGIN_KEY = new PluginKey("goose-slash-menu-reconcile");
const SLASH_TRIGGERS = new Set(["/", "、"]);

function slashPolicy(
  allowSlashMenuOnFirstBlockRef: { current: boolean },
): SlashMenuPagePolicy {
  return { allowSlashMenuOnFirstBlock: allowSlashMenuOnFirstBlockRef.current };
}

/** 整块 NodeSelection 时，把 `/` 或 `、` 插到正文开头并打开斜杠菜单，不替换整块。 */
export function typeSlashAtSelectedBlockStart(
  editor: BlockNoteEditor<any, any, any>,
  text: string,
  policy: SlashMenuPagePolicy,
): boolean {
  if (!editor.isEditable || !SLASH_TRIGGERS.has(text)) return false;
  const state = editor.prosemirrorState;
  if (!(state.selection instanceof NodeSelection)) return false;
  const selected = state.selection.node;
  const content = selected.firstChild;
  const start =
    selected.type.name === "blockContainer" && content?.isTextblock
      ? state.selection.from + 2
      : selected.isTextblock
        ? state.selection.from + 1
        : null;
  if (start == null) return false;
  const probe = state.tr.setSelection(TextSelection.create(state.doc, start));
  if (!shouldOpenSlashSuggestionMenu(probe, editor, policy)) return false;
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, start));
    tr.insertText(text, start);
  });
  const menu = editor.getExtension(SuggestionMenu) as
    | { openSuggestionMenu?: (trigger: string) => void }
    | undefined;
  menu?.openSuggestionMenu?.(text);
  return true;
}

export function createGooseSlashMenuReconcileExtension(
  allowSlashMenuOnFirstBlockRef: { current: boolean },
  editorRef: { current: BlockNoteEditor<any, any, any> | null },
) {
  const reconcile = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const policy = slashPolicy(allowSlashMenuOnFirstBlockRef);
    reconcileSlashSuggestionMenu(ed, policy);
    reconcilePageMentionSuggestionMenu(ed);
  };
  return createExtension({
    key: "goose-slash-menu-reconcile",
    prosemirrorPlugins: [
      new Plugin({
        key: PLUGIN_KEY,
        props: {
          handleKeyDown(_view, event) {
            const ed = editorRef.current;
            if (
              !ed ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey ||
              event.isComposing ||
              !SLASH_TRIGGERS.has(event.key)
            ) {
              return false;
            }
            return typeSlashAtSelectedBlockStart(
              ed,
              event.key,
              slashPolicy(allowSlashMenuOnFirstBlockRef),
            );
          },
          handleTextInput(_view, _from, _to, text) {
            const ed = editorRef.current;
            if (!ed || !SLASH_TRIGGERS.has(text)) return false;
            return typeSlashAtSelectedBlockStart(
              ed,
              text,
              slashPolicy(allowSlashMenuOnFirstBlockRef),
            );
          },
          handleDOMEvents: {
            compositionend: () => {
              queueMicrotask(reconcile);
              return false;
            },
          },
        },
        appendTransaction(transactions, _oldState, _newState) {
          if (!transactions.some((t) => t.docChanged)) return null;
          queueMicrotask(reconcile);
          return null;
        },
      }),
    ],
  });
}