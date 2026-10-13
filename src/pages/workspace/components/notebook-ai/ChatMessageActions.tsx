import { ActionBarPrimitive, BranchPickerPrimitive } from "@assistant-ui/react";
import { Copy, ChevronLeft, ChevronRight } from "lucide-react";

/** 按原父渲染时机创建 renderer；不增加组件/DOM 包装。 */
export function createMessageActionBar() {
  const MessageActionBar = () => (
    <div className="notebook-ai-message-actions mt-1 flex h-6 min-h-6 items-center gap-1">
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="never"
        autohideFloat="never"
        className="flex items-center gap-1"
      >
        <ActionBarPrimitive.Copy
          copiedDuration={1600}
          className="flex h-6 w-6 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] disabled:hidden"
          aria-label="复制消息"
          title="复制"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
        </ActionBarPrimitive.Copy>
      </ActionBarPrimitive.Root>
      <BranchPickerPrimitive.Root
        hideWhenSingleBranch
        className="flex items-center gap-0.5 text-[11px] text-muted-foreground"
      >
        <BranchPickerPrimitive.Previous
          className="flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] disabled:opacity-40"
          aria-label="上一个回答分支"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </BranchPickerPrimitive.Previous>
        <span>
          <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
        </span>
        <BranchPickerPrimitive.Next
          className="flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] disabled:opacity-40"
          aria-label="下一个回答分支"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </BranchPickerPrimitive.Next>
      </BranchPickerPrimitive.Root>
    </div>
  );
  return MessageActionBar;
}
