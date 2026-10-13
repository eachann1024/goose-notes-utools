import { useCallback, useEffect } from "react";
import { createRequestID, postToHost } from "./bridge";
import type { EditorPreferences } from "./types";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import { EDITOR_FONT_SIZE_DEFAULT, normalizeEditorFontSize } from "./nativeEditorDefinitions";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorPreferences({
  matchesCurrentEnvelope,
  setAppearance,
  setFont,
  setFontSize,
  setFullWidth,
  pageRef,
  setCurrentPage,
}: Pick<NativeEditorBindings,
  "matchesCurrentEnvelope" | "setAppearance" | "setFont" | "setFontSize" | "setFullWidth" | "pageRef" |
  "setCurrentPage"
>) {

  const applyPreferences = useCallback(
    (preferences: EditorPreferences) => {
      if (!matchesCurrentEnvelope(preferences)) return;
      setAppearance(preferences.appearance);
      setFont(preferences.editorFont);
      const nextFontSize = normalizeEditorFontSize(preferences.editorFontSize);
      setFontSize(nextFontSize);
      setFullWidth(preferences.fullWidth);
      const root = document.documentElement;
      root.classList.toggle("dark", preferences.appearance === "dark");
      root.dataset.theme = preferences.appearance;
      root.dataset.editorFont = preferences.editorFont;
      root.dataset.editorFontSize = String(nextFontSize);
      root.dataset.fullWidth = String(preferences.fullWidth);
      root.dataset.reduceMotion = String(preferences.reduceMotion);
      root.dataset.increaseContrast = String(preferences.increaseContrast);
      root.style.setProperty("--editor-font-size", `${nextFontSize}px`);
      root.style.setProperty(
        "--editor-scale",
        (nextFontSize / EDITOR_FONT_SIZE_DEFAULT).toFixed(4),
      );
      const editorUiScale = (nextFontSize / EDITOR_FONT_SIZE_DEFAULT).toFixed(
        4,
      );
      if (root.style.getPropertyValue("--editor-ui-scale") !== editorUiScale) {
        root.style.setProperty("--editor-ui-scale", editorUiScale);
        window.dispatchEvent(
          new CustomEvent(EDITOR_UI_SCALE_CHANGE_EVENT, {
            detail: { scale: editorUiScale },
          }),
        );
      }
      root.style.colorScheme = preferences.appearance;
      const current = pageRef.current;
      if (current) {
        setCurrentPage({
          ...current,
          fontFamily:
            preferences.editorFont === "sans"
              ? "default"
              : preferences.editorFont,
        });
      }
    },
    [matchesCurrentEnvelope, setCurrentPage],
  );

  return { applyPreferences };
}

export function useNativeEditorAIEntry({
  setAIUnavailableMessage,
}: Pick<NativeEditorBindings, "setAIUnavailableMessage">) {

  useEffect(() => {
    const showUnavailableAI = () => {
      const context = window.__gooseBridgeContext;
      if (context?.pageID && window.webkit?.messageHandlers?.gooseNotes) {
        postToHost({
          version: 1,
          type: "aiWorkspaceEntry",
          requestID: createRequestID(),
          pageID: context.pageID,
          revision: context.revision,
        });
        return;
      }
      setAIUnavailableMessage(
        "AI 生成功能需要在原生应用中配置服务后才能使用。",
      );
    };
    window.addEventListener("goose-note:native-ai-entry", showUnavailableAI);
    return () =>
      window.removeEventListener(
        "goose-note:native-ai-entry",
        showUnavailableAI,
      );
  }, []);
}
