import { cn } from "@/lib/utils";
import { MathView } from "@/components/editor/blocks/math/MathView";
import { MermaidView } from "@/components/editor/blocks/mermaid/MermaidView";
import type { RefObject } from "react";

export function CodeBlockContent({
  collapsed,
  isVisualBlock,
  showLineNumbers,
  shouldShowSource,
  lineCount,
  wrap,
  handlePaste,
  contentRef,
  shouldShowPreview,
  previewRef,
  canPreview,
  handleInternalPreview,
  language,
  textContent,
}: {
  collapsed: boolean;
  isVisualBlock: boolean;
  showLineNumbers: boolean;
  shouldShowSource: boolean;
  lineCount: number;
  wrap: boolean;
  handlePaste: (event: React.ClipboardEvent<HTMLPreElement>) => void;
  contentRef: any;
  shouldShowPreview: boolean;
  previewRef: RefObject<HTMLDivElement | null>;
  canPreview: boolean;
  handleInternalPreview: () => Promise<void>;
  language: string;
  textContent: string;
}) {
  return (
    (!collapsed || isVisualBlock) && (
      <div className="goose-code-content-wrapper">
        {showLineNumbers && shouldShowSource && (
          <div className="goose-code-line-numbers" contentEditable={false}>
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}
        <pre
          className={cn(
            "goose-code-pre",
            wrap && "goose-code-pre-wrap",
            isVisualBlock && "goose-code-pre-source",
            !shouldShowSource && "goose-code-pre-hidden",
          )}
          aria-hidden={!shouldShowSource}
          onPaste={handlePaste}
        >
          <code
            ref={contentRef}
            className="goose-code-content hljs"
            style={
              wrap
                ? {
                    whiteSpace: "break-spaces",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }
                : undefined
            }
          />
        </pre>
        {shouldShowPreview && (
          <div
            ref={previewRef}
            contentEditable={false}
            className={cn("goose-code-preview select-none bg-transparent cursor-pointer")}
            onDoubleClick={() => {
              if (canPreview) void handleInternalPreview();
            }}
          >
            {language === "math" && <MathView value={textContent} displayMode={true} />}
            {language === "mermaid" && <MermaidView value={textContent} />}
          </div>
        )}
      </div>
    )
  );
}
