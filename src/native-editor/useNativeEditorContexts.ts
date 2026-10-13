import { useMemo } from "react";
import { type EditorPageContext, type EditorSettings } from "@/components/editor/platform/hostContext";
import { EMPTY_AI_SETTINGS } from "./nativeEditorDefinitions";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorContexts({
  appearance,
  fontSize,
  fullWidth,
  page,
  applyingHostPageRef,
  pageRef,
  setCurrentPage,
  markDirty,
  pageIDRef,
}: Pick<NativeEditorBindings,
  "appearance" | "fontSize" | "fullWidth" | "page" | "applyingHostPageRef" | "pageRef" |
  "setCurrentPage" | "markDirty" | "pageIDRef"
>) {

  const settings = useMemo<EditorSettings>(
    () => ({
      theme: appearance,
      editorFontSize: fontSize,
      customFonts: {
        default: { label: null, font: null },
        serif: { label: null, font: null },
        mono: { label: null, font: null },
      },
      defaultCodeBlockWrap: false,
      onDefaultCodeBlockWrapChange: () => {},
      ai: EMPTY_AI_SETTINGS,
      searchProviders: [],
      customActions: [],
      openLinksInHost: false,
      // 原生编辑器当前没有系统 openPath 桥，保留内置灯箱作为可用回退。
      useInternalImageViewer: true,
      features: {
        tablePresentationControls: false,
        mermaidUnsafeHTML: false,
        transcodeVideoUploads: false,
        openAttachmentsExternally: false,
      },
    }),
    [appearance, fontSize, fullWidth],
  );

  const pageContext = useMemo<EditorPageContext | null>(
    () =>
      page
        ? {
            page,
            contentMode: "raw",
            isEditorFullWidth: fullWidth,
            onContentChange: (content, options) => {
              if (applyingHostPageRef.current) return;
              const current = pageRef.current;
              if (current) setCurrentPage({ ...current, content });
              if (!options?.silent) markDirty();
            },
            onOpenPage: () => false,
            getActivePageLocalFilePath: () => pageIDRef.current,
            // 原生编辑器宿主没有「本地文件夹笔记本」概念，路径 tag 不启用。
            getActivePageLocalFolderRoot: () => null,
            searchPages: () => [],
            resolvePageContexts: () => [],
            getLatestPage: (pageId) =>
              pageRef.current?.id === pageId ? pageRef.current : null,
            onPromotePreview: () => {},
          }
        : null,
    [fullWidth, markDirty, page, setCurrentPage],
  );

  return { settings, pageContext };
}
