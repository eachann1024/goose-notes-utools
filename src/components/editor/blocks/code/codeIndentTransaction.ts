import { Fragment } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { indentCodeSelection } from "./codeBlockIndent";
import { getCodeDomSelection } from "./codeDomSelection";

export function codeTextToInlineFragment(schema: any, text: string) {
  if (!text) return Fragment.empty;
  const hardBreakType = schema.nodes.hardBreak;
  const nodes: any[] = [];

  text.split("\n").forEach((line, index) => {
    if (index > 0 && hardBreakType) nodes.push(hardBreakType.create());
    if (line) nodes.push(schema.text(line));
  });

  return nodes.length > 0 ? Fragment.fromArray(nodes) : Fragment.empty;
}

export function findCodeBlockDepth($pos: any) {
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if ($pos.node(depth)?.type?.name === "codeBlock") return depth;
  }
  return null;
}

export function applyCodeBlockIndentTransaction(tr: any, outdent: boolean) {
  const { $from, $to } = tr.selection;
  const fromCodeDepth = findCodeBlockDepth($from);
  const toCodeDepth = findCodeBlockDepth($to);
  if (fromCodeDepth == null || toCodeDepth == null || $from.before(fromCodeDepth) !== $to.before(toCodeDepth)) {
    return false;
  }

  const codeBlockNode = $from.node(fromCodeDepth);
  const contentStart = $from.start(fromCodeDepth);
  const domSelection = getCodeDomSelection();
  const currentText = domSelection?.text ?? codeBlockNode.textBetween(0, codeBlockNode.content.size, "\n", "\n");
  const selectionStart = domSelection?.start ?? $from.pos - contentStart;
  const selectionEnd = domSelection?.end ?? $to.pos - contentStart;
  const next = indentCodeSelection(currentText, selectionStart, selectionEnd, {
    outdent,
  });
  const replacement = codeTextToInlineFragment(tr.doc.type.schema, next.text);

  tr.replaceWith(contentStart, contentStart + codeBlockNode.content.size, replacement);
  tr.setSelection(TextSelection.create(tr.doc, contentStart + next.selectionStart, contentStart + next.selectionEnd));
  return true;
}
