import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";
import { LATEX_SNIPPETS } from "./codeLatexSnippets";

export function CodeLatexHints({
  collapsed,
  language,
  isEditable,
  showLatexHint,
  setShowLatexHint,
}: {
  collapsed: boolean;
  language: string;
  isEditable: boolean;
  showLatexHint: boolean;
  setShowLatexHint: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    !collapsed &&
    language === "math" &&
    isEditable && (
      <div className="absolute bottom-2 right-2 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLatexHint(!showLatexHint)}
          className={cn(
            "h-6 w-6 p-0 rounded-md",
            "border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)]",
            showLatexHint && "border-[var(--goose-callout-accent)] bg-[var(--goose-interactive-selected)] text-primary",
          )}
        >
          <LucideIcons.HelpCircle className="h-3.5 w-3.5" />
        </Button>
        {showLatexHint && (
          <div className="absolute bottom-8 right-0 z-30 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-3 shadow-lg">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <span className="text-xs font-semibold">LaTeX 语法参考</span>
              <button
                type="button"
                onClick={() => setShowLatexHint(false)}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)]"
              >
                <LucideIcons.X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 gap-1.5">
                {LATEX_SNIPPETS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setShowLatexHint(false)}
                    className="flex flex-col items-start gap-1 rounded-md border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] px-2 py-1.5 text-left hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
                  >
                    <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                    <code className="text-[11px] font-mono text-foreground break-all">{s.code}</code>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  );
}
