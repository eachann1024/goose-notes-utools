import { useState, useRef } from "react";
import { useEditorSettings } from "@/components/editor/platform/hostContext";
import { useEditorPlatform } from "@/components/editor/platform/context";
import { FullscreenPreview } from "@/components/preview/FullscreenPreview";
import { type PreviewContent } from "@/lib/preview/previewAction";
import type { CodePreviewMode } from "./codePreviewPolicy";
import { useCodeBlockEdit } from "./useCodeBlockEdit";
import { useCodeBlockTabIndent } from "./useCodeBlockTabIndent";
import { useCodePreviewExport } from "./useCodePreviewExport";
import { useCodePreviewActions } from "./useCodePreviewActions";
import { useCodePreviewLifecycle } from "./useCodePreviewLifecycle";
import { CodeBlockHeader } from "./CodeBlockHeader";
import { CodeBlockContent } from "./CodeBlockContent";
import { CodeLatexHints } from "./CodeLatexHints";

export function CodeBlockComponent({ block, contentRef, editor }: { block: any; contentRef: any; editor: any }) {
  const { onDefaultCodeBlockWrapChange, theme } = useEditorSettings();
  const platform = useEditorPlatform();
  const language = (block.props.language as string) || "text";
  const wrap = block.props.wrap === true;
  const collapsed = block.props.collapsed === true;
  const summary = typeof block.props.summary === "string" ? block.props.summary : "";
  const isEditable = editor.isEditable;

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [showLatexHint, setShowLatexHint] = useState(false);
  const [previewMode, setPreviewMode] = useState<CodePreviewMode>("code");
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const {
    getCodeContent,
    handleLanguageChange,
    handleWrapChange,
    handleSummaryCommit,
    handleCollapsedChange,
    handleFormat,
    handlePaste,
  } = useCodeBlockEdit({
    block,
    contentRef,
    editor,
    onDefaultCodeBlockWrapChange,
    summaryDraft,
    summary,
    setSummaryDraft,
    setIsEditingSummary,
    collapsed,
  });
  const { handleCodeKeyDownCapture } = useCodeBlockTabIndent({
    isEditable,
    rootRef,
    editor,
    block,
  });
  const { resolvePreviewPngBlob, handleDownloadPreview, handleCopyPreview } = useCodePreviewExport({
    getCodeContent,
    language,
    theme,
    previewRef,
    platform,
  });
  const { handleSystemPreview, handleInternalPreview } = useCodePreviewActions({
    getCodeContent,
    language,
    theme,
    setPreviewContent,
  });

  const textContent = getCodeContent();
  const lineCount = textContent.split("\n").length;
  // yaml-frontmatter 是可编辑的普通代码块，不做表格预览；
  // math/mermaid 才走视觉预览（紧凑编辑器构建退化为可编辑源码）。
  const isMathOrMermaid = !__GOOSE_EDITOR_COMPACT__ && (language === "math" || language === "mermaid");
  const isVisualBlock = isMathOrMermaid;
  const canPreview = isMathOrMermaid && textContent.trim().length > 0;
  const shouldShowPreview = canPreview && previewMode === "preview";
  const shouldShowSource = !isVisualBlock || previewMode === "code" || !canPreview;
  const showLineNumbers = !isVisualBlock && !wrap;
  const visualTitle = language === "math" ? "Math" : "Mermaid";
  useCodePreviewLifecycle({
    isEditingSummary,
    summaryInputRef,
    isVisualBlock,
    setPreviewMode,
    setPreviewContent,
    canPreview,
  });

  return (
    <div
      ref={rootRef}
      className="goose-code-block-node relative"
      data-collapsed={collapsed ? "true" : "false"}
      data-visual-preview={isVisualBlock ? "true" : undefined}
      onKeyDownCapture={handleCodeKeyDownCapture}
    >
      {/* Toolbar row */}
      <CodeBlockHeader
        isVisualBlock={isVisualBlock}
        visualTitle={visualTitle}
        collapsed={collapsed}
        handleCollapsedChange={handleCollapsedChange}
        summaryInputRef={summaryInputRef}
        isEditingSummary={isEditingSummary}
        summaryDraft={summaryDraft}
        summary={summary}
        isEditable={isEditable}
        setSummaryDraft={setSummaryDraft}
        setIsEditingSummary={setIsEditingSummary}
        handleSummaryCommit={handleSummaryCommit}
        language={language}
        handleLanguageChange={handleLanguageChange}
        getCodeContent={getCodeContent}
        handleFormat={handleFormat}
        wrap={wrap}
        handleWrapChange={handleWrapChange}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        canPreview={canPreview}
        handleInternalPreview={handleInternalPreview}
        handleSystemPreview={handleSystemPreview}
        handleDownloadPreview={handleDownloadPreview}
        handleCopyPreview={handleCopyPreview}
      />

      {/* Code content */}
      <CodeBlockContent
        collapsed={collapsed}
        isVisualBlock={isVisualBlock}
        showLineNumbers={showLineNumbers}
        shouldShowSource={shouldShowSource}
        lineCount={lineCount}
        wrap={wrap}
        handlePaste={handlePaste}
        contentRef={contentRef}
        shouldShowPreview={shouldShowPreview}
        previewRef={previewRef}
        canPreview={canPreview}
        handleInternalPreview={handleInternalPreview}
        language={language}
        textContent={textContent}
      />

      <FullscreenPreview
        open={Boolean(previewContent)}
        content={previewContent}
        title={language === "math" ? "公式预览" : "Mermaid"}
        onClose={() => setPreviewContent(null)}
      />

      {/* LaTeX hint panel */}
      <CodeLatexHints
        collapsed={collapsed}
        language={language}
        isEditable={isEditable}
        showLatexHint={showLatexHint}
        setShowLatexHint={setShowLatexHint}
      />
    </div>
  );
}
