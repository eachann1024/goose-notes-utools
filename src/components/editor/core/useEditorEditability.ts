import { useEffect } from "react";
import { GooseAIExtension } from "@/components/editor/ai/GooseAIExtension";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorInstance } from "./editorTypes";

export function useEditorEditability({
  editor,
  activePageId,
  editable,
  page,
}: {
  editor: EditorInstance;
  activePageId: string | null;
  editable: boolean;
  page: EditorPageContext["page"];
}) {
  useLayoutEffect(() => {
    if (!__GOOSE_EDITOR_AI__) return;
    const inlineAi = editor.getExtension(GooseAIExtension);
    inlineAi?.invalidateIfNeeded();
    return () => inlineAi?.closeAIMenu();
  }, [editor, activePageId, editable, page.isLocked, page.trashedAt, page.localReadState]);

  // BlockNoteView 的 editable 会在 prop 变化时重挂 ProseMirror。
  // 实例上的 isEditable 也要立刻同步，锁定当帧就不能输入。
  useEffect(() => {
    if (editor.isEditable === editable) return;
    editor.isEditable = editable;
  }, [editor, editable]);
}
