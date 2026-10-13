import { useCallback } from "react";
import { renderMermaidSvgForExport } from "@/lib/imageExport/mermaid";
import { toast } from "@/components/ui/sonner";
import { openPreviewInSystem, type PreviewContent } from "@/lib/preview/previewAction";
import type { Dispatch, SetStateAction } from "react";
import type { EditorSettings } from "@/components/editor/platform/hostContext";
import { isDarkTheme } from "./codePreviewPolicy";

export function useCodePreviewActions({
  getCodeContent,
  language,
  theme,
  setPreviewContent,
}: {
  getCodeContent: () => string;
  language: string;
  theme: EditorSettings["theme"];
  setPreviewContent: Dispatch<SetStateAction<PreviewContent | null>>;
}) {
  const handleSystemPreview = useCallback(async () => {
    try {
      const text = getCodeContent().trim();
      if (!text) throw new Error("无可预览内容");

      if (language === "mermaid") {
        const svg = await renderMermaidSvgForExport(text, isDarkTheme(theme) ? "dark" : "light");
        await openPreviewInSystem({
          kind: "svg",
          markup: svg,
          fileName: "mermaid.svg",
          background: isDarkTheme(theme) ? "#1F1E1C" : "#ffffff",
        });
        return;
      }

      if (language === "math") {
        await openPreviewInSystem({
          kind: "math",
          source: text,
          fileName: "formula.html",
        });
        return;
      }

      throw new Error("当前代码块不支持系统预览");
    } catch (err) {
      toast.error(`系统预览失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [getCodeContent, language, theme]);

  const handleInternalPreview = useCallback(async () => {
    try {
      const text = getCodeContent().trim();
      if (!text) throw new Error("无可预览内容");

      if (language === "mermaid") {
        const svg = await renderMermaidSvgForExport(text, isDarkTheme(theme) ? "dark" : "light");
        setPreviewContent({
          kind: "svg",
          markup: svg,
          fileName: "mermaid.svg",
          background: isDarkTheme(theme) ? "#1F1E1C" : "#ffffff",
        });
        return;
      }

      if (language === "math") {
        setPreviewContent({
          kind: "math",
          source: text,
          fileName: "formula.html",
        });
        return;
      }

      throw new Error("当前代码块不支持预览");
    } catch (err) {
      toast.error(`预览失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [getCodeContent, language, theme]);
  return { handleSystemPreview, handleInternalPreview };
}
