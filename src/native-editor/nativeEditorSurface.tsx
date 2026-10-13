import { AlertCircle, FileText, RotateCcw } from "lucide-react";
import { Editor } from "@/components/editor/core/Editor";
import { EditorPlatformProvider } from "@/components/editor/platform/context";
import { EditorHostProvider } from "@/components/editor/platform/hostContext";
import { nativeEditorPlatform } from "./runtime";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function renderNativeEditorSurface({
  appearance,
  font,
  fontSize,
  mode,
  isLoadingPage,
  committedPageToken,
  composingRef,
  compositionWaitersRef,
  pageIDRef,
  saveState,
  errorMessage,
  reload,
  retry,
  aiUnavailableMessage,
  setAIUnavailableMessage,
  repairDeclined,
  primaryGateActionRef,
  acceptRepair,
  keepOriginal,
  page,
  pageContext,
  settings,
  editorGeneration,
  editorRef,
}: Pick<NativeEditorBindings,
  "appearance" | "font" | "fontSize" | "mode" | "isLoadingPage" | "committedPageToken" |
  "composingRef" | "compositionWaitersRef" | "pageIDRef" | "saveState" | "errorMessage" | "reload" |
  "retry" | "aiUnavailableMessage" | "setAIUnavailableMessage" | "repairDeclined" |
  "primaryGateActionRef" | "acceptRepair" | "keepOriginal" | "page" | "pageContext" | "settings" |
  "editorGeneration" | "editorRef"
>) {
  return (
    <main
      className="native-editor-root"
      data-theme={appearance}
      data-font-family={font === "sans" ? "default" : font}
      data-font-size={String(fontSize)}
      data-editor-mode={mode}
      data-loading={String(isLoadingPage)}
      data-page-load-token={String(committedPageToken)}
      data-testid="editor-surface"
      onCompositionStartCapture={() => {
        composingRef.current = true;
      }}
      onCompositionEndCapture={() => {
        composingRef.current = false;
        compositionWaitersRef.current.splice(0).forEach((resolve) => resolve());
      }}
    >
      {pageIDRef.current ? (
        <>
          {(saveState === "failed" || saveState === "conflict") && (
            <div
              className="native-editor-error"
              role="alert"
              data-testid="save-error"
            >
              <AlertCircle aria-hidden="true" size={17} />
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={saveState === "conflict" ? reload : retry}
              >
                <RotateCcw aria-hidden="true" size={14} />
                {saveState === "conflict" ? "重新载入" : "重试"}
              </button>
            </div>
          )}
          {aiUnavailableMessage && (
            <div className="native-ai-notice" role="status">
              <span>{aiUnavailableMessage}</span>
              <button type="button" onClick={() => setAIUnavailableMessage("")}>
                知道了
              </button>
            </div>
          )}
          {isLoadingPage ? (
            <div
              className="native-editor-placeholder"
              role="status"
              aria-live="polite"
            >
              <FileText aria-hidden="true" size={28} />
              <p>正在载入文档…</p>
            </div>
          ) : mode === "repair-required" ? (
            <section
              className="native-format-gate"
              aria-labelledby="native-format-gate-title"
              aria-describedby="native-format-gate-description native-format-gate-detail"
              data-testid="format-repair-gate"
            >
              <div
                className="native-format-gate__content"
                role="status"
                aria-live="polite"
              >
                <span className="native-format-gate__icon" aria-hidden="true">
                  <FileText size={24} />
                </span>
                <h1 id="native-format-gate-title">
                  {repairDeclined ? "已保持原文" : "此文件需要先整理格式"}
                </h1>
                <p id="native-format-gate-description">
                  {repairDeclined
                    ? "编辑器没有加载或修改此文件。需要编辑时，可再选择修复格式。"
                    : "其中有编辑器暂时不能完整保留的 Markdown 写法，原文件尚未更改。"}
                </p>
                <p
                  className="native-format-gate__detail"
                  id="native-format-gate-detail"
                >
                  修复后会转换为编辑器支持的格式，并保存到原文件。
                </p>
                <div className="native-format-gate__actions">
                  <button
                    ref={primaryGateActionRef}
                    className="native-format-gate__primary"
                    type="button"
                    onClick={acceptRepair}
                  >
                    {repairDeclined ? "修复格式并加载" : "加载并修复格式"}
                  </button>
                  {!repairDeclined && (
                    <button
                      className="native-format-gate__secondary"
                      type="button"
                      onClick={keepOriginal}
                    >
                      保持原文
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : mode === "unavailable" ? (
            <section
              className="native-format-gate"
              aria-labelledby="native-format-unavailable-title"
              aria-describedby="native-format-unavailable-description"
              data-testid="format-unavailable-gate"
            >
              <div
                className="native-format-gate__content"
                role="status"
                aria-live="polite"
              >
                <span className="native-format-gate__icon" aria-hidden="true">
                  <FileText size={24} />
                </span>
                <h1 id="native-format-unavailable-title">
                  此文件暂时无法安全加载
                </h1>
                <p id="native-format-unavailable-description">
                  原文件没有修改。请确认文件仍是有效的 Markdown 后重试。
                </p>
                <div className="native-format-gate__actions">
                  <button
                    ref={primaryGateActionRef}
                    className="native-format-gate__secondary"
                    type="button"
                    onClick={reload}
                  >
                    重新载入文件
                  </button>
                </div>
              </div>
            </section>
          ) : page && pageContext ? (
            <div
              className="page-scroll-container native-editor-scroll"
              data-testid="editor-document"
            >
              <EditorPlatformProvider platform={nativeEditorPlatform}>
                <EditorHostProvider
                  settings={settings}
                  pageContext={pageContext}
                >
                  <Editor
                    key={`${page.id}:${editorGeneration}`}
                    ref={editorRef}
                    editable
                    showSideMenu
                    spellCheck
                  />
                </EditorHostProvider>
              </EditorPlatformProvider>
            </div>
          ) : null}
          <p className="native-sr-only" aria-live="polite" aria-atomic="true">
            {saveState === "saving"
              ? "正在保存"
              : saveState === "saved"
                ? "已保存"
                : ""}
          </p>
        </>
      ) : (
        <div className="native-editor-placeholder" aria-label="未打开文件">
          <FileText aria-hidden="true" size={34} />
          <p>新建或打开 Markdown 文件开始写作</p>
        </div>
      )}
    </main>
  );
}
