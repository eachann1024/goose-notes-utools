import "./dom.ts";
import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { gooseHeadingBlockSpec } from "../../src/components/editor/blocks/heading/headingBlockSpec.ts";
import { getBlockNoteSlashMenuItems } from "../../src/components/editor/core/blocknoteSlashItems.tsx";
import { gooseEmptyBlockBackspaceExtension } from "../../src/components/editor/extensions/emptyBlockBackspaceExtension.ts";
import {
  deleteEmptyLineBackward,
  deleteSelectedBlocks,
  gooseCrossBlockDeleteExtension,
} from "../../src/components/editor/extensions/crossBlockDeleteExtension.ts";
import {
  createGooseSlashMenuReconcileExtension,
  typeSlashAtSelectedBlockStart,
} from "../../src/components/editor/extensions/gooseSlashMenuReconcileExtension.ts";
import { createGooseBodyParagraphGuardExtension } from "../../src/components/editor/extensions/bodyParagraphGuardExtension.ts";
import { createGooseFirstTitleGuardExtension } from "../../src/components/editor/inputrules/firstTitleGuard.ts";
import { gooseMarkdownInputRulesExtension } from "../../src/components/editor/inputrules/markdownInputRules.ts";
import { shouldOpenSlashSuggestionMenu } from "../../src/components/editor/utils/slashMenuPolicy.ts";

const raw = { current: false };
const textOf = (block: any) =>
  Array.isArray(block?.content)
    ? block.content.map((part: any) => part?.text ?? "").join("")
    : "";

function createEditor(content: any[]) {
  const editorRef: { current: BlockNoteEditor<any, any, any> | null } = { current: null };
  const editor = BlockNoteEditor.create({
    schema: BlockNoteSchema.create({
      blockSpecs: { ...defaultBlockSpecs, heading: gooseHeadingBlockSpec },
    }),
    initialContent: content,
    extensions: [
      createGooseFirstTitleGuardExtension(raw),
      createGooseBodyParagraphGuardExtension(raw),
      gooseCrossBlockDeleteExtension,
      gooseEmptyBlockBackspaceExtension,
      gooseMarkdownInputRulesExtension(),
      createGooseSlashMenuReconcileExtension(raw, editorRef),
    ],
  });
  editorRef.current = editor;
  editor.focus = () => {};
  const host = document.createElement("div");
  document.body.appendChild(host);
  editor.mount(host);
  return editor;
}

function withBody(second: any) {
  return createEditor([
    { type: "heading", props: { level: 1 }, content: "Title" },
    second,
    { type: "paragraph", content: "Next" },
  ]);
}

function heading(text: string, level = 2) {
  return withBody({ type: "heading", props: { level }, content: text });
}

function press(editor: BlockNoteEditor<any, any, any>, key: string) {
  const view = editor.prosemirrorView;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  return Boolean(view.someProp("handleKeyDown", (fn) => fn(view, event)));
}

function selectText(editor: BlockNoteEditor<any, any, any>, id: string) {
  editor.setTextCursorPosition(id, "start");
  const from = editor.prosemirrorState.selection.from;
  editor.setTextCursorPosition(id, "end");
  const to = editor.prosemirrorState.selection.from;
  editor.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, from, to)));
}

function selectBlock(editor: BlockNoteEditor<any, any, any>, id: string) {
  let pos = -1;
  editor.prosemirrorState.doc.descendants((node, nodePos) => {
    if (pos >= 0) return false;
    if (node.type.name === "blockContainer" && String(node.attrs.id) === id) {
      pos = nodePos;
      return false;
    }
    return true;
  });
  editor.transact((tr) => tr.setSelection(NodeSelection.create(tr.doc, pos)));
}

function typeSpace(editor: BlockNoteEditor<any, any, any>) {
  const view = editor.prosemirrorView;
  const from = view.state.selection.from;
  const handled = Boolean(view.someProp("handleTextInput", (fn) => fn(view, from, from, " ")));
  if (!handled) editor.transact((tr) => tr.insertText(" "));
  return handled;
}

export async function run(): Promise<number> {
  let failed = 0;
  const check = (name: string, ok: boolean) => {
    console.log(`${ok ? "✓" : "✗"} ${name}`);
    if (!ok) failed += 1;
  };

const empty = heading("");
const emptyId = empty.document[1].id;
empty.setTextCursorPosition(emptyId, "start");
check(
  "空二级标题退格删掉该块",
  press(empty, "Backspace") && !empty.getBlock(emptyId) && textOf(empty.document[1]) === "Next",
);

const byDelete = heading("");
const deleteId = byDelete.document[1].id;
byDelete.setTextCursorPosition(deleteId, "start");
check("空二级标题 Delete 删掉该块", deleteEmptyLineBackward(byDelete) && !byDelete.getBlock(deleteId));

const typed = heading("Hello");
typed.setTextCursorPosition(typed.document[1], "start");
check(
  "有字二级标题在行首退格改回段落并保留文字",
  press(typed, "Backspace") && typed.document[1].type === "paragraph" && textOf(typed.document[1]) === "Hello",
);

const whole = heading("Hello");
const wholeId = whole.document[1].id;
selectText(whole, wholeId);
check(
  "选中二级标题全部文字后删除该块",
  deleteSelectedBlocks(whole) && !whole.getBlock(wholeId) && textOf(whole.document.at(-1)) === "Next",
);

const node = heading("Hello");
const nodeId = node.document[1].id;
selectBlock(node, nodeId);
check("整块选中后 Delete 删掉二级标题", press(node, "Delete") && !node.getBlock(nodeId));

const title = heading("Hello");
const titleId = title.document[0].id;
selectText(title, titleId);
check(
  "文档标题整段选中不删标题块",
  !deleteSelectedBlocks(title) && title.getBlock(titleId)?.type === "heading" && textOf(title.document[0]) === "Title",
);
title.setTextCursorPosition(titleId, "start");
press(title, "Backspace");
press(title, "Delete");
check("空文档标题退格和 Delete 都不删标题块", title.document[0].id === titleId && title.document[0].type === "heading");

const kept = withBody({ type: "paragraph", content: "Hello" });
selectText(kept, kept.document[1].id);
check(
  "普通段落整段选中不整块删除",
  !deleteSelectedBlocks(kept) && kept.document[1].type === "paragraph" && textOf(kept.document[1]) === "Hello",
);

for (const [marks, level] of [["#", 1], ["##", 2], ["###", 3]] as const) {
  const editor = withBody({ type: "paragraph", content: marks });
  editor.setTextCursorPosition(editor.document[1], "end");
  const applied = typeSpace(editor);
  const block = editor.document[1];
  check(
    `${marks} 加空格变成 ${level} 级标题`,
    applied && block.type === "heading" && block.props.level === level && textOf(block) === "",
  );
}

for (const marks of ["####", "#####", "######"]) {
  const editor = withBody({ type: "paragraph", content: marks });
  editor.setTextCursorPosition(editor.document[1], "end");
  const applied = typeSpace(editor);
  const block = editor.document[1];
  check(
    `${marks} 加空格仍按现有规则变成 ${marks.length} 级标题`,
    applied && block.type === "heading" && block.props.level === marks.length && textOf(block) === "",
  );
}

const slash = withBody({ type: "paragraph", content: "Hello" });
slash.setTextCursorPosition(slash.document[1], "start");
check(
  "段落块首允许打开斜杠菜单",
  shouldOpenSlashSuggestionMenu(slash.prosemirrorState.tr, slash, { allowSlashMenuOnFirstBlock: false }),
);
const slashFrom = slash.prosemirrorState.selection.from;
slash.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, slashFrom + 2)));
check(
  "块中间不打开斜杠菜单",
  !shouldOpenSlashSuggestionMenu(slash.prosemirrorState.tr, slash, { allowSlashMenuOnFirstBlock: false }),
);

const emptySlash = withBody({ type: "paragraph", content: "" });
emptySlash.setTextCursorPosition(emptySlash.document[1], "start");
check(
  "空段落块首允许打开斜杠菜单",
  shouldOpenSlashSuggestionMenu(emptySlash.prosemirrorState.tr, emptySlash, { allowSlashMenuOnFirstBlock: false }),
);

const headingSlash = heading("Hello");
headingSlash.setTextCursorPosition(headingSlash.document[1], "start");
check(
  "标题块首允许打开斜杠菜单",
  shouldOpenSlashSuggestionMenu(headingSlash.prosemirrorState.tr, headingSlash, { allowSlashMenuOnFirstBlock: false }),
);
headingSlash.transact((tr) => tr.insertText("/"));
const oldWindow = globalThis.window;
const oldDocument = globalThis.document;
const oldRaf = globalThis.requestAnimationFrame;
globalThis.window = { setTimeout: () => 0 } as unknown as Window & typeof globalThis.window;
globalThis.document = { querySelector: () => null } as unknown as Document;
globalThis.requestAnimationFrame = () => 0;
try {
  const items = getBlockNoteSlashMenuItems(headingSlash, false, {
    transcodeVideoUploads: false,
    openAttachmentsExternally: false,
  });
  const heading2 = items.find((item) => item.title === "二级标题");
  heading2?.onItemClick();
} finally {
  globalThis.window = oldWindow;
  globalThis.document = oldDocument;
  globalThis.requestAnimationFrame = oldRaf;
}
check(
  "块首斜杠选二级标题时保留已有文字",
  headingSlash.document[1].type === "heading" &&
    headingSlash.document[1].props.level === 2 &&
    textOf(headingSlash.document[1]) === "Hello",
);

const selected = heading("Hello");
selectBlock(selected, selected.document[1].id);
check(
  "整块选中后 / 插到块首并保留原文",
  typeSlashAtSelectedBlockStart(selected, "/", { allowSlashMenuOnFirstBlock: false }) &&
    textOf(selected.document[1]) === "/Hello" &&
    selected.document[1].type === "heading",
);

const chord = heading("Hello");
selectBlock(chord, chord.document[1].id);
const chordPlugin = chord.getExtension("goose-slash-menu-reconcile") as {
  prosemirrorPlugins?: { props: { handleKeyDown?: (view: unknown, event: KeyboardEvent) => boolean } }[];
} | undefined;
const chordView = chord.prosemirrorView;
const chordEvent = new KeyboardEvent("keydown", { key: "/", ctrlKey: true, bubbles: true, cancelable: true });
const chordHandled = chordPlugin?.prosemirrorPlugins?.[0]?.props.handleKeyDown?.(chordView, chordEvent);
check(
  "整块选中时 Ctrl+/ 不插入斜杠",
  chordHandled !== true && textOf(chord.document[1]) === "Hello",
);

const extension = selected.getExtension("goose-slash-menu-reconcile") as {
  prosemirrorPlugins?: { props: { handleDOMEvents?: { compositionend?: (...args: any[]) => boolean } } }[];
} | undefined;
let composed = false;
const originalQueue = globalThis.queueMicrotask;
globalThis.queueMicrotask = ((task: () => void) => {
  composed = true;
  task();
}) as typeof queueMicrotask;
try {
  extension?.prosemirrorPlugins?.[0]?.props.handleDOMEvents?.compositionend?.({} as any, {} as any);
} finally {
  globalThis.queueMicrotask = originalQueue;
}
  check("输入法 compositionend 会再尝试打开斜杠菜单", composed);

  return failed;
}
