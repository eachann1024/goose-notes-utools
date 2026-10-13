import type { JSONContent } from "@/types";
import {
  clonePageContent as cloneBlockNotePageContent,
  createEmptyBlockNoteContent,
  createEmptyLocalPageContent,
  normalizePageContent,
} from "@/components/editor/utils/blocknote-content";
import { UNTITLED_PAGE_TITLE } from "@/components/editor/utils/page-title";

const initialContent: JSONContent =
  createEmptyBlockNoteContent(UNTITLED_PAGE_TITLE);

export function createDefaultPageContent(
  title = UNTITLED_PAGE_TITLE,
): JSONContent {
  return createEmptyBlockNoteContent(title);
}

export function clonePageContent(content?: JSONContent | null) {
  if (!content) {
    return cloneBlockNotePageContent(initialContent);
  }
  return cloneBlockNotePageContent(normalizePageContent(content));
}

// local-folder 页面标题由文件名（LocalFileTitle）承担，内容不存在
// 「首块必须是 H1」的约束，克隆时禁止 ensureFirstTitleHeading 注入空标题块。
export function cloneLocalPageContent(content?: JSONContent | null) {
  if (!content) {
    return cloneBlockNotePageContent(createEmptyLocalPageContent());
  }
  return cloneBlockNotePageContent(
    normalizePageContent(content, { ensureFirstTitle: false }),
  );
}
