import { useCallback } from "react";
import { renderMermaidSvgForExport } from "@/lib/imageExport/mermaid";
import { captureElementAsPngBlob, svgMarkupToPngBlob } from "@/lib/imageExport/svgToPng";
import { blobToBase64, convertImageBlobToPng } from "@/lib/imageProcessor";
import { toast } from "@/components/ui/sonner";
import { saveBlobAndReveal } from "@/lib/export/fileSave";
import type { RefObject } from "react";
import type { EditorSettings } from "@/components/editor/platform/hostContext";
import type { EditorPlatform } from "@/components/editor/platform/types";
import { isDarkTheme } from "./codePreviewPolicy";

export function useCodePreviewExport({
  getCodeContent,
  language,
  theme,
  previewRef,
  platform,
}: {
  getCodeContent: () => string;
  language: string;
  theme: EditorSettings["theme"];
  previewRef: RefObject<HTMLDivElement | null>;
  platform: EditorPlatform;
}) {
  const resolvePreviewPngBlob = useCallback(async (): Promise<Blob> => {
    const text = getCodeContent().trim();
    if (!text || typeof document === "undefined") {
      throw new Error("无可导出内容");
    }

    if (language === "mermaid") {
      const svg = await renderMermaidSvgForExport(text, isDarkTheme(theme) ? "dark" : "light");
      return svgMarkupToPngBlob(svg);
    }

    if (language === "math") {
      if (previewRef.current) {
        try {
          const captured = await captureElementAsPngBlob(previewRef.current);
          return convertImageBlobToPng(captured);
        } catch {
          // 预览节点截图失败时走离屏渲染
        }
      }

      const { default: katex } = await import("katex");
      const wrapper = document.createElement("div");
      wrapper.style.cssText = [
        "position:fixed",
        "left:-99999px",
        "top:0",
        "z-index:-1",
        "padding:16px 24px",
        `color:${isDarkTheme(theme) ? "#e5e7eb" : "#111827"}`,
        "background:transparent",
        "font-size:18px",
        "line-height:1.4",
        "display:inline-block",
      ].join(";");
      katex.render(text, wrapper, {
        displayMode: true,
        throwOnError: false,
      });
      document.body.appendChild(wrapper);
      try {
        const blob = await captureElementAsPngBlob(wrapper);
        return convertImageBlobToPng(blob);
      } finally {
        document.body.removeChild(wrapper);
      }
    }

    throw new Error("当前类型不支持导出图片");
  }, [getCodeContent, language, theme]);

  const handleDownloadPreview = useCallback(async () => {
    const text = getCodeContent().trim();
    if (!text || typeof document === "undefined") return;

    try {
      if (language === "mermaid" || language === "math") {
        const pngBlob = await resolvePreviewPngBlob();
        const filename = language === "math" ? `formula-${Date.now()}.png` : `mermaid-${Date.now()}.png`;
        const saved = await saveBlobAndReveal(pngBlob, filename);
        if (saved) toast.success("图片已保存到下载文件夹");
        else toast.error("保存失败");
        return;
      }

      const saved = await saveBlobAndReveal(new Blob([text], { type: "text/plain;charset=utf-8" }), "code.txt");
      if (saved) toast.success("已保存到下载文件夹");
      else toast.error("保存失败");
    } catch (err) {
      toast.error(`下载失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [getCodeContent, language, resolvePreviewPngBlob]);

  const handleCopyPreview = useCallback(async () => {
    try {
      const pngBlob = await resolvePreviewPngBlob();
      const dataUrl = await blobToBase64(pngBlob);
      await platform.clipboard.copyImage(dataUrl);
      toast.success("已复制到剪贴板");
    } catch (err) {
      toast.error(`复制失败: ${err instanceof Error ? err.message : "未知错误"}`);
      throw err;
    }
  }, [platform, resolvePreviewPngBlob]);
  return { resolvePreviewPngBlob, handleDownloadPreview, handleCopyPreview };
}
