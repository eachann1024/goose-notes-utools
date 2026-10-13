import { useEffect } from "react";
import {
  getSelectedCellPlainText,
  getSelectedImageUrl,
  getSelectedPlainTextContext,
  normalizeClipboardLineEndings,
  shouldPreferVisibleSelectionText,
  stripMarkdownHardBreaks,
} from "./EditorComposer";
import { copyImageSrcToClipboard } from "@/components/editor/image/imageUtils";
import type { RefObject } from "react";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorPlatform } from "@/components/editor/platform/types";
import type { EditorInstance } from "./editorTypes";

export function useEditorClipboard({
  editorContainerRef,
  editor,
  platformRef,
  getActivePageLocalFilePathRef,
}: {
  editorContainerRef: RefObject<HTMLDivElement | null>;
  editor: EditorInstance;
  platformRef: RefObject<EditorPlatform>;
  getActivePageLocalFilePathRef: RefObject<EditorPageContext["getActivePageLocalFilePath"]>;
}) {
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const patchClipboardPlainText = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      // BlockNote 默认会把 NodeSelection 图片块复制成 Markdown：
      // ![name](att:...)。复制操作应给系统剪贴板写入真正的图片数据。
      if (event.type === "copy") {
        const selectedImageUrl = getSelectedImageUrl(editor.prosemirrorState);
        if (selectedImageUrl) {
          event.preventDefault();
          void copyImageSrcToClipboard(
            selectedImageUrl,
            platformRef.current,
            getActivePageLocalFilePathRef.current(),
          ).catch((error) => {
            console.error("[editor] Failed to copy selected image", error);
          });
          return;
        }
      }

      const cellText = getSelectedCellPlainText(editor.prosemirrorState);
      if (cellText != null) {
        event.preventDefault();
        clipboardData.setData("text/plain", cellText);
        clipboardData.setData("text/html", "");
        return;
      }

      const clipboardText = normalizeClipboardLineEndings(clipboardData.getData("text/plain"));
      // cut 时 PM 已写入剪贴板后才删选区；不拿 DOM 可见字覆盖 plain/html，
      // 否则行内 code 会被拆成两段（复制正常、剪切异常）。只清理 markdown 软换行反斜杠。
      const cleaned = stripMarkdownHardBreaks(clipboardText);
      if (cleaned !== clipboardText) {
        clipboardData.setData("text/plain", cleaned);
        return;
      }

      const selectionContext = getSelectedPlainTextContext(container);
      if (!selectionContext) return;

      if (
        shouldPreferVisibleSelectionText(clipboardText, selectionContext.selectedText, selectionContext.withinCodeBlock)
      ) {
        clipboardData.setData("text/plain", selectionContext.selectedText);
      }
    };

    container.addEventListener("copy", patchClipboardPlainText);
    container.addEventListener("cut", patchClipboardPlainText);

    return () => {
      container.removeEventListener("copy", patchClipboardPlainText);
      container.removeEventListener("cut", patchClipboardPlainText);
    };
  }, []);
}
