import { useEffect } from "react";
import { type PreviewContent } from "@/lib/preview/previewAction";
import type { RefObject, Dispatch, SetStateAction } from "react";
import type { CodePreviewMode } from "./codePreviewPolicy";

export function useCodePreviewLifecycle({
  isEditingSummary,
  summaryInputRef,
  isVisualBlock,
  setPreviewMode,
  setPreviewContent,
  canPreview,
}: {
  isEditingSummary: boolean;
  summaryInputRef: RefObject<HTMLInputElement | null>;
  isVisualBlock: boolean;
  setPreviewMode: Dispatch<SetStateAction<CodePreviewMode>>;
  setPreviewContent: Dispatch<SetStateAction<PreviewContent | null>>;
  canPreview: boolean;
}) {
  useEffect(() => {
    if (!isEditingSummary) return;
    const timer = setTimeout(() => {
      summaryInputRef.current?.focus();
      summaryInputRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
  }, [isEditingSummary]);

  useEffect(() => {
    // yaml-frontmatter 是普通可编辑代码块，不支持预览，永远是源码态。
    // 仅 math/mermaid 这类以渲染图为主的块自动切到预览。
    if (!isVisualBlock) {
      setPreviewMode("code");
      setPreviewContent(null);
      return;
    }
    if (!canPreview) {
      setPreviewMode("code");
      setPreviewContent(null);
      return;
    }
    setPreviewMode((current) => (current === "code" ? "preview" : current));
  }, [isVisualBlock, canPreview]);
}
