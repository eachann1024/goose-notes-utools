import type { ChatMessagesProps } from "./ChatMessageContext";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { useState, useMemo } from "react";
import type { PreviewContent } from "@/lib/preview/previewAction";
import { shouldShowChatTimeDivider, formatChatMessageTime } from "@/lib/notebook-ai/messageTime";
import { createMessageActionBar } from "./ChatMessageActions";
import { createUserMessageRenderer } from "./ChatUserMessage";
import { createAssistantMessageRenderer } from "./ChatAssistantMessage";
import { ChatChrome } from "./beautiful-ui/ChatChrome";
import { AssistantUiThreadViewport } from "./AssistantUiThreadViewport";
import { cn } from "@/lib/utils";
import { MessageSquareText, Sparkles, ArrowDown } from "lucide-react";
import { ThreadPrimitive } from "@assistant-ui/react";
import { FullscreenPreview } from "@/components/preview/FullscreenPreview";

/** 消息列表编排：原状态/memo 归属、thread viewport 与预览层保持。 */
export function ChatMessages({
  messages,
  streamingMessageId,
  editorRef,
  layout = "side-panel",
  onBatchApproval,
  onBatchUndo,
}: ChatMessagesProps) {
  const { onOpenPage } = useEditorPageContext();
  const isFullscreen = layout === "fullscreen";
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(
    null,
  );
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  /** messageId → 格式化时间文案；无则不展示分隔条 */
  const showTimeById = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const previous = i > 0 ? messages[i - 1] : null;
      if (!shouldShowChatTimeDivider(current, previous)) continue;
      const at = current.metadata?.createdAt;
      if (typeof at !== "number") continue;
      const label = formatChatMessageTime(at);
      if (label) map.set(current.id, label);
    }
    return map;
  }, [messages]);

  const toolRenderBase = useMemo(
    () => ({
      editorRef,
      onBatchApproval,
      onBatchUndo,
    }),
    [editorRef, onBatchApproval, onBatchUndo],
  );

  const MessageActionBar = createMessageActionBar();

  const renderUserMessage = createUserMessageRenderer({ setPreviewContent, onOpenPage, MessageActionBar });

  const renderAssistantMessage = createAssistantMessageRenderer({ toolRenderBase, MessageActionBar });

  return (
    <ChatChrome className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <AssistantUiThreadViewport
        className={cn(
          // min-w-0：flex 子项可收缩；横向溢出由消息内表格滚动，这里只负责纵向
          "notebook-ai-messages min-w-0 flex-1 overflow-x-hidden overflow-y-scroll [scrollbar-width:thin]",
          messages.length === 0
            ? "flex items-center justify-center pb-[var(--ai-composer-float-pad,7.5rem)]"
            : undefined,
          isFullscreen ? "px-6 pt-5" : "px-3 pt-3",
        )}
      >
        {messages.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center gap-3 text-center",
              isFullscreen ? "max-w-[360px]" : "max-w-[260px]",
            )}
          >
            <div
              className={cn(
                "relative flex items-center justify-center rounded-[12px] bg-[var(--goose-interactive-hover)] text-muted-foreground",
                isFullscreen ? "h-12 w-12" : "h-11 w-11",
              )}
            >
              <MessageSquareText
                className={isFullscreen ? "h-6 w-6" : "h-5 w-5"}
                strokeWidth={1.75}
              />
              <Sparkles
                className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={1.75}
              />
            </div>
            <p
              className={cn(
                "font-medium text-foreground",
                isFullscreen ? "text-[15px]" : "text-sm",
              )}
            >
              开始和 AI 对话
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isFullscreen
                ? "全屏会话模式：整理、搜索、创作笔记，随时可切回侧栏并排。"
                : "让它帮你整理、搜索、创作笔记。"}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto w-full min-w-0 max-w-full space-y-3",
              isFullscreen ? "max-w-[720px]" : "max-w-none",
            )}
          >
            <ThreadPrimitive.Messages>
              {({ message }) => {
                const sourceMessage = messageById.get(message.id);
                if (!sourceMessage) return null;
                const timeLabel = showTimeById.get(sourceMessage.id);
                const body =
                  sourceMessage.role === "user"
                    ? renderUserMessage(sourceMessage)
                    : renderAssistantMessage(
                        sourceMessage,
                        streamingMessageId === sourceMessage.id,
                      );
                return (
                  <>
                    {timeLabel ? (
                      <div
                        className="notebook-ai-message-time"
                        role="separator"
                        aria-label={timeLabel}
                      >
                        {timeLabel}
                      </div>
                    ) : null}
                    {body}
                  </>
                );
              }}
            </ThreadPrimitive.Messages>
            <ThreadPrimitive.ViewportFooter className="pointer-events-none sticky bottom-[calc(var(--ai-composer-float-pad,7.5rem)+12px)] z-10 flex h-0 justify-center overflow-visible">
              <ThreadPrimitive.ScrollToBottom
                className="pointer-events-auto flex h-8 w-8 -translate-y-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)] disabled:hidden"
                aria-label="滚动到底部"
                title="滚动到底部"
              >
                <ArrowDown className="h-4 w-4" strokeWidth={1.75} />
              </ThreadPrimitive.ScrollToBottom>
            </ThreadPrimitive.ViewportFooter>
            <div
              className="pointer-events-none h-[var(--ai-composer-float-pad,7.5rem)] shrink-0"
              aria-hidden
            />
          </div>
        )}
      </AssistantUiThreadViewport>
      <FullscreenPreview
        open={Boolean(previewContent)}
        content={previewContent}
        title={previewContent?.fileName}
        onClose={() => setPreviewContent(null)}
      />
    </ChatChrome>
  );
}

export { buildUserMessageSegments } from "@/lib/notebook-ai/userMessageSegments";
export { ASSISTANT_TEXT_PARTS, ASSISTANT_APPROVAL_PARTS, ASSISTANT_ARTIFACT_PARTS } from "./ChatAssistantParts";
