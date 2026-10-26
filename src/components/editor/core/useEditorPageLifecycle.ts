import { useLayoutEffect } from "react";
import { EditorState } from "@tiptap/pm/state";
import {
  clonePageContent,
  createEditorSafeContent,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import type { RefObject } from "react";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorInstance } from "./editorTypes";
import type { useEditorContentSnapshot } from "./useEditorContentSnapshot";
import { toEditorBlocks, getCachedContentSignature } from "./editorContentPolicy";

export function useEditorPageLifecycle({
  activePageId,
  onContentChange,
  contentMode,
  commitEditorContent,
  prevPageIdRef,
  userInteractedRef,
  pendingEditorChangeRef,
  debouncedUpdate,
  pageRef,
  pageIdForUpdateRef,
  contentModeRef,
  editor,
  syncedContentSignatureRef,
  onContentChangeRef,
}: {
  activePageId: string | null;
  onContentChange: EditorPageContext["onContentChange"];
  contentMode: EditorPageContext["contentMode"];
  commitEditorContent: (targetPageId?: string) => void;
  prevPageIdRef: RefObject<string | null>;
  userInteractedRef: RefObject<boolean>;
  pendingEditorChangeRef: RefObject<boolean>;
  debouncedUpdate: ReturnType<typeof useEditorContentSnapshot>["debouncedUpdate"];
  pageRef: RefObject<EditorPageContext["page"]>;
  pageIdForUpdateRef: RefObject<string | null>;
  contentModeRef: RefObject<EditorPageContext["contentMode"]>;
  editor: EditorInstance;
  syncedContentSignatureRef: RefObject<string | null>;
  onContentChangeRef: RefObject<EditorPageContext["onContentChange"]>;
}) {
  useLayoutEffect(() => {
    if (activePageId === prevPageIdRef.current) {
      onContentChangeRef.current = onContentChange;
      contentModeRef.current = contentMode;
      return;
    }
    commitEditorContent();
    pageIdForUpdateRef.current = null;
    prevPageIdRef.current = activePageId;

    // 切页起点即重置：侧栏点击等切页前的 pointerdown 不应算进新页面的用户编辑。
    userInteractedRef.current = false;
    pendingEditorChangeRef.current = false;

    debouncedUpdate.cancel();

    const p = pageRef.current;

    // raw 文档跳过 normalizePageContent（不触发 ensureFirstTitleHeading）。
    // 须与 EditorComposer.onChange 的 contentMode 判断一致：
    // raw 文档同样豁免，否则切页/重开时会把首块强转 H1 并刷新签名基线。
    const isLocalPage = contentMode === "raw";
    const nextContent = isLocalPage ? toEditorBlocks(p?.content) : normalizePageContent(p?.content);
    const nextEditorContent = createEditorSafeContent(nextContent, editor.schema);
    const nextSig = getCachedContentSignature(nextEditorContent);

    syncedContentSignatureRef.current = nextSig;

    try {
      editor.replaceBlocks(editor.document, nextEditorContent as any);
    } catch (error) {
      console.error("[goose-note] replace editor blocks failed during page switch", {
        pageId: p?.id,
        error,
      });
      const fallbackContent = createEditorSafeContent(undefined, editor.schema);
      editor.replaceBlocks(editor.document, fallbackContent as any);
    }

    // replaceBlocks 后 appendTransaction（firstTitleGuard 等）可能已修改文档。
    // 用编辑器实际文档的签名更新基线，防止初始化触发的 onChange 误判为真实编辑。
    // 基线计算必须与 EditorComposer.onChange 完全一致（local 用 raw 文档，
    // 内部页面经 normalizePageContent），否则签名比较永不相等、打开即触发保存。
    const postReplaceRaw = clonePageContent(editor.document as BlockNoteContent);
    syncedContentSignatureRef.current = getCachedContentSignature(
      isLocalPage ? postReplaceRaw : normalizePageContent(postReplaceRaw),
    );

    // Reset undo history so edits from the previous page don't leak
    const view = editor.prosemirrorView;
    if (view) {
      const newState = EditorState.create({
        doc: view.state.doc,
        plugins: view.state.plugins,
      });
      view.updateState(newState);
    }

    onContentChangeRef.current = onContentChange;
    contentModeRef.current = contentMode;
    pageIdForUpdateRef.current = p?.id ?? null;

    // normalize 改写了结构才回写（silent 路径：只同步内存，不触发写盘/标脏）。
    // local 页面不回写：内容未经 normalize，store 保持磁盘解析原样
    // （空文件的编辑器兜底空段落只是呈现层，不应进 store）。
    const normalizedSig = getCachedContentSignature(nextContent);
    if (p && !isLocalPage && getCachedContentSignature(p.content) !== normalizedSig) {
      onContentChangeRef.current(nextContent, { silent: true });
    }

    // 切页完成 = 新一轮程序化同步起点，重置用户交互标记：
    // 切页后 BlockNote 的异步 props 补全（折叠块/视频等）不应被算作用户编辑。
    userInteractedRef.current = false;
  }, [activePageId, onContentChange, contentMode, commitEditorContent, debouncedUpdate, editor]);
}
