import { useEffect, useRef, useState } from "react";
import { useEditorSettings } from "@/components/editor/platform/hostContext";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { loadMermaid } from "@/lib/imageExport/loadMermaid";
import {
  getMermaidInitConfig,
  stripMermaidInitDirectives,
} from "@/lib/imageExport/mermaidTheme";
import { sanitizeRenderedSvg } from "@/lib/notebook-ai/svgSanitizer";
import { tryRenderMermaidTimeline } from "@/lib/imageExport/timelineSvg";

interface MermaidViewProps {
  value: string;
}

export const MermaidView: React.FC<MermaidViewProps> = ({ value }) => {
  const [svg, setSvg] = useState<string>("");
  const { theme } = useEditorSettings();
  const resolvedTheme = useResolvedTheme(theme);
  const skipDebounceRef = useRef(true);

  useEffect(() => {
    let active = true;
    const isDark = resolvedTheme === "dark";

    const renderMermaid = async () => {
      if (!value) {
        setSvg("");
        return;
      }
      try {
        const timeline = tryRenderMermaidTimeline(
          value,
          isDark ? "dark" : "light",
        );
        if (timeline) {
          if (active) setSvg(sanitizeRenderedSvg(timeline));
          return;
        }
        const mermaid = await loadMermaid();
        if (!active) return;
        mermaid.initialize(
          getMermaidInitConfig({
            mode: isDark ? "dark" : "light",
            securityLevel: "strict",
            fontFamily: "inherit",
            useMaxWidth: true,
          }),
        );
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, stripMermaidInitDirectives(value));
        if (!active) return;
        setSvg(sanitizeRenderedSvg(svg));
      } catch {
        if (active) setSvg("");
      }
    };

    const delay = skipDebounceRef.current ? 0 : 500;
    skipDebounceRef.current = false;
    const debounceTimer = window.setTimeout(() => {
      void renderMermaid();
    }, delay);
    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [value, resolvedTheme]);

  if (!svg) return null;

  return (
    <div
      className="mermaid-preview flex justify-center overflow-x-auto bg-transparent"
      style={{ padding: "var(--editor-code-preview-padding, 16px)" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
