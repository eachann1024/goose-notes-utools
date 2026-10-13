import { useCallback, useEffect } from "react";
import { commitPendingEditorChange } from "./editorPendingCommit";
import type { RefObject } from "react";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { useEditorContentSnapshot } from "./useEditorContentSnapshot";

export function useEditorContentCommit({
  pageIdForUpdateRef,
  debouncedUpdate,
  readCurrentEditorContent,
  pendingEditorChangeRef,
  syncedContentSignatureRef,
  onContentChangeRef,
}: {
  pageIdForUpdateRef: RefObject<string | null>;
  debouncedUpdate: ReturnType<typeof useEditorContentSnapshot>["debouncedUpdate"];
  readCurrentEditorContent: ReturnType<typeof useEditorContentSnapshot>["readCurrentEditorContent"];
  pendingEditorChangeRef: RefObject<boolean>;
  syncedContentSignatureRef: RefObject<string | null>;
  onContentChangeRef: RefObject<EditorPageContext["onContentChange"]>;
}) {
  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      debouncedUpdate.cancel();
      const { content, signature } = readCurrentEditorContent();
      const result = commitPendingEditorChange({
        targetPageId: safePageId,
        currentPageId: pageIdForUpdateRef.current,
        pending: pendingEditorChangeRef.current,
        content,
        signature,
        syncedSignature: syncedContentSignatureRef.current,
        commit: (nextContent) => onContentChangeRef.current(nextContent),
      });
      if (result === "committed" || result === "unchanged") {
        pendingEditorChangeRef.current = false;
      }
      if (result === "committed") syncedContentSignatureRef.current = signature;
    },
    [debouncedUpdate, readCurrentEditorContent],
  );

  useEffect(() => {
    return () => {
      // React 卸载仍处于同步阶段；先把最后一帧送入 store/journal，再取消定时器。
      commitEditorContent(pageIdForUpdateRef.current ?? undefined);
    };
  }, [commitEditorContent]);
  return { commitEditorContent };
}
