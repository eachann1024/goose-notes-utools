/**
 * Notebook AI 会话运行时（与面板 UI 解耦）
 *
 * - 在 Workspace 层常驻：关面板 / 切页不卸载，流式请求可继续
 * - 顶栏 AI 图标状态由本模块同步（streaming → done → idle）
 * - 仅笔记本切换、关闭 AI 能力或卸载 Workspace 时才 stop 并清理
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useChat } from "@ai-sdk/react";
import type { ChatTransport } from "ai";
import { toast } from "@/components/ui/sonner";
import type { EditorRef } from "@/components/editor/core/Editor";
import {
  useNotebookAiChats,
  composerDraftHasContent,
} from "@/stores/useNotebookAiChats";
import { useAiStatus } from "@/stores/useAiStatus";
import { buildTransport } from "@/lib/notebook-ai/transport";
import { reloadEditorIfActive } from "@/lib/notebook-ai/liveWriter";
import {
  executePreparedBatchPlan,
  undoBatchPlan,
  updateBatchPlanSelection,
} from "@/lib/notebook-ai/batch-plan";
import { buildLanguageModel } from "@/lib/notebook-ai/model";
import {
  buildNotebookAiUserMessage,
  getCurrentNotebookAiPageId,
  getNotebookAiReferenceSuggestions,
} from "@/lib/notebook-ai/context";
import {
  prepareNotebookAiMessagesForModel,
  sanitizeNotebookAiMessages,
} from "@/lib/notebook-ai/messageUtils";
import { ensureNotebookAiMessageCreatedAt } from "@/lib/notebook-ai/messageTime";
import type {
  BatchApprovalResponse,
  BatchUndoResult,
} from "./ApprovalPlanCard";
import type { NotebookAiImageAttachment } from "./Composer";
import type { NotebookAiPanelSelectionCapture } from "./useNotebookAiPanel";
import type { AiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
import { NotebookAiAssistantRuntimeProvider } from "./AssistantUiRuntimeProvider";
import {
  buildCompactedConversation,
  conversationHasCompactableContent,
  generateConversationCompactSummary,
} from "@/lib/notebook-ai/compactConversation";

import {
  markBatchUndoToolParts,
  replaceBatchApprovalToolParts,
  type BatchApprovalToolState,
} from "./session/batchToolMessages";

/** 流式响应持续无任何消息更新时自动收尾，避免旧 Electron 内核永久占用会话。 */
const NOTEBOOK_AI_STREAM_IDLE_TIMEOUT_MS = 60_000;

export const NOTEBOOK_AI_PLACEHOLDER_HINTS = [
  "向 AI 提问，/ 调用指令或 Skill，@ 引用笔记或本地文件…",
  "让 AI 根据当前笔记生成一张趋势图…",
  "让 AI 画一个流程图或架构图…",
  "让 AI 生成一张图标或示意图…",
  "试试：总结 @本地文件，并画出要点关系图…",
];

function createChatMessageId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createImageFileList(
  images: NotebookAiImageAttachment[],
): FileList | undefined {
  if (images.length === 0) return undefined;
  const dataTransfer = new DataTransfer();
  images.forEach(({ file }) => dataTransfer.items.add(file));
  return dataTransfer.files;
}

export function formatNotebookAiChatError(error: Error): string {
  return formatNotebookAiError(error);
}

export interface NotebookAiSessionValue {
  notebookId: string;
  conversationId: string;
  messages: NotebookAiMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  clearError: () => void;
  stop: () => void;
  isStreaming: boolean;
  isBusy: boolean;
  unavailableReason: string | undefined;
  placeholderIndex: number;
  composerRevision: number;
  /** 用户显式新建空白会话后，不要再种默认 @ 当前页 */
  suppressDefaultPageSeed: boolean;
  send: (
    payload: AiComposerPayload,
    imageAttachments: NotebookAiImageAttachment[],
    options?: {
      capturedSelection?: NotebookAiPanelSelectionCapture | null;
      onConsumeCapturedSelection?: () => void;
    },
  ) => boolean;
  newConversation: (options?: {
    onConsumeCapturedSelection?: () => void;
  }) => void;
  compactConversation: () => void;
  selectConversation: (
    nextConversationId: string,
    options?: { onConsumeCapturedSelection?: () => void },
  ) => void;
  /** 删除历史会话；流式生成中拒绝。返回是否已执行删除 */
  deleteConversation: (targetConversationId: string) => boolean;
  searchPages: (
    query: string,
  ) => ReturnType<typeof getNotebookAiReferenceSuggestions>;
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void>;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

const NotebookAiSessionContext = createContext<NotebookAiSessionValue | null>(
  null,
);

export function useNotebookAiSession(): NotebookAiSessionValue {
  const value = useContext(NotebookAiSessionContext);
  if (!value) {
    throw new Error(
      "useNotebookAiSession 必须在 NotebookAiSessionProvider 内使用",
    );
  }
  return value;
}

interface NotebookAiSessionProviderProps {
  notebookId: string;
  editorRef?: RefObject<EditorRef | null>;
  children: ReactNode;
  /** 单测注入：复现 SDK Chat 的跨 render 回调语义，不参与产品调用。 */
  useChatHook?: typeof useChat;
}

interface NotebookAiSessionScope {
  notebookId: string;
  conversationId: string;
  generation: number;
}

function sessionScopeKey(scope: NotebookAiSessionScope) {
  return JSON.stringify([
    scope.notebookId,
    scope.conversationId,
    scope.generation,
  ]);
}

export function NotebookAiSessionProvider({
  notebookId,
  children,
  useChatHook,
}: NotebookAiSessionProviderProps) {
  const requestCurrentPageIdRef = useRef<string | null>(null);
  const compactAbortRef = useRef<AbortController | null>(null);
  const [session, setSession] = useState<NotebookAiSessionScope>(() => ({
    notebookId,
    conversationId: useNotebookAiChats
      .getState()
      .ensureFreshActiveConversation(notebookId),
    generation: 0,
  }));
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [composerRevision, setComposerRevision] = useState(0);
  const [suppressDefaultPageSeed, setSuppressDefaultPageSeed] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const batchWorkRef = useRef(new Map<string, number>());
  const [, notifyBatchWorkChanged] = useState(0);

  // 当同一 Provider 实例收到新笔记本时，在 render 期间一次性切换会话状态，
  // 让子节点不会拿到旧 notebook 的消息。
  // 真正停止旧 Chat/压缩任务留给 layout effect，避免在 render 中执行副作用。
  if (session.notebookId !== notebookId) {
    const nextConversationId = useNotebookAiChats
      .getState()
      .ensureFreshActiveConversation(notebookId);
    setSession({
      notebookId,
      conversationId: nextConversationId,
      generation: session.generation + 1,
    });
    setPlaceholderIndex(0);
    setSuppressDefaultPageSeed(false);
    setIsCompacting(false);
  }
  const { conversationId, generation: sessionGeneration } = session;
  const currentSessionScope = useMemo<NotebookAiSessionScope>(
    () => ({
      notebookId,
      conversationId,
      generation: sessionGeneration,
    }),
    [conversationId, notebookId, sessionGeneration],
  );
  const activeSessionScopeRef = useRef(currentSessionScope);
  const isCurrentSession = useCallback(
    (scope: NotebookAiSessionScope) =>
      activeSessionScopeRef.current.notebookId === scope.notebookId &&
      activeSessionScopeRef.current.conversationId === scope.conversationId &&
      activeSessionScopeRef.current.generation === scope.generation,
    [],
  );
  const setConversationId = useCallback(
    (nextConversationId: string) =>
      setSession((current) => ({
        ...current,
        conversationId: nextConversationId,
      })),
    [],
  );

  const composerHasContent = useNotebookAiChats((s) =>
    composerDraftHasContent(s.composerDrafts[notebookId]),
  );

  const modelCheck = buildLanguageModel();

  const persistedMessages = useMemo(
    () =>
      useNotebookAiChats
        .getState()
        .getConversationMessages(notebookId, conversationId),
    [notebookId, conversationId],
  );

  // useChat 只在 chat id 改变时重建 Chat；transport 必须保持稳定，
  // 并在真正发送时再绑定本轮最新的页签上下文。
  const transport = useMemo<ChatTransport<NotebookAiMessage>>(
    () => ({
      async sendMessages(options) {
        const currentPageId =
          requestCurrentPageIdRef.current ??
          getCurrentNotebookAiPageId(notebookId);
        const result = buildTransport(notebookId, currentPageId);
        if (!result.ok) {
          throw new Error(result.reason);
        }

        return result.transport.sendMessages({
          ...options,
          messages: prepareNotebookAiMessagesForModel(options.messages),
        });
      },
      async reconnectToStream(options) {
        const currentPageId =
          requestCurrentPageIdRef.current ??
          getCurrentNotebookAiPageId(notebookId);
        const result = buildTransport(notebookId, currentPageId);
        if (!result.ok) {
          throw new Error(result.reason);
        }
        return result.transport.reconnectToStream(options);
      },
    }),
    [notebookId],
  );

  const useChatImpl = useChatHook ?? useChat;
  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
    clearError,
  } = useChatImpl<NotebookAiMessage>({
    transport,
    id: `notebook-ai-${notebookId}-${conversationId}`,
    messages: persistedMessages,
    // 流式 token 不节流会每字触发 messages → 全树 commit + Streamdown 重解析，整面板卡顿。
    // ~50ms ≈ 20fps UI 更新，观感仍流畅，React commit 次数大幅下降。
    experimental_throttle: 50,
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const isBatchRunning =
    (batchWorkRef.current.get(sessionScopeKey(currentSessionScope)) ?? 0) > 0;
  const isBusy = isStreaming || isCompacting || isBatchRunning;
  const unavailableReason = !modelCheck.ok ? modelCheck.reason : undefined;
  const aiStatusActiveRef = useRef(false);
  const messagesRef = useRef(messages);
  const committedStopRef = useRef(stop);

  useLayoutEffect(() => {
    activeSessionScopeRef.current = currentSessionScope;
    committedStopRef.current = stop;
    messagesRef.current = messages;
  }, [currentSessionScope, messages, stop]);

  useLayoutEffect(() => {
    requestCurrentPageIdRef.current = null;
    return () => {
      compactAbortRef.current?.abort();
      void committedStopRef.current();
      // 切换不是一次成功完成，不能在新笔记本上误触发 celebrate。
      if (aiStatusActiveRef.current) {
        aiStatusActiveRef.current = false;
        useAiStatus.getState().reset();
      }
    };
  }, [notebookId]);

  // SDK 的 functional updater 同步读取当前 Chat 的最新消息，避免 await 后
  // 把新回复或另一个批次的结果覆盖成回调创建时的旧 render 快照。
  const updateSessionMessages = useCallback(
    (
      scope: NotebookAiSessionScope,
      update: (currentMessages: NotebookAiMessage[]) => NotebookAiMessage[],
    ) => {
      if (!isCurrentSession(scope)) return;
      let nextMessages: NotebookAiMessage[] | undefined;
      setMessages((currentMessages) => {
        if (!isCurrentSession(scope)) return currentMessages;
        nextMessages = update(currentMessages);
        return nextMessages;
      });
      if (!nextMessages || !isCurrentSession(scope)) return;
      messagesRef.current = nextMessages;
      useNotebookAiChats
        .getState()
        .setMessages(scope.notebookId, scope.conversationId, nextMessages);
    },
    [isCurrentSession, setMessages],
  );

  const beginBatchWork = useCallback(
    (scope: NotebookAiSessionScope) => {
      const key = sessionScopeKey(scope);
      batchWorkRef.current.set(key, (batchWorkRef.current.get(key) ?? 0) + 1);
      notifyBatchWorkChanged((revision) => revision + 1);
      return () => {
        const remaining = (batchWorkRef.current.get(key) ?? 1) - 1;
        if (remaining > 0) batchWorkRef.current.set(key, remaining);
        else batchWorkRef.current.delete(key);
        if (isCurrentSession(scope)) {
          notifyBatchWorkChanged((revision) => revision + 1);
        }
      };
    },
    [isCurrentSession],
  );

  const streamStateRef = useRef<{
    scope: NotebookAiSessionScope;
    wasStreaming: boolean;
  } | null>(null);

  // @ai-sdk/react 会把旧 Chat 的 onFinish 转发给最新 render 的 callback；笔记本
  // 切换时该 callback 无法辨认消息来自哪个 Chat。改为只观察当前 Chat 的状态转变，
  // 并按捕获的会话 scope 落盘，旧流即使迟到也不会触碰新会话。
  useEffect(() => {
    const scope = currentSessionScope;
    const previous = streamStateRef.current;
    streamStateRef.current = { scope, wasStreaming: isStreaming };
    if (
      !previous ||
      previous.scope.notebookId !== scope.notebookId ||
      previous.scope.conversationId !== scope.conversationId ||
      previous.scope.generation !== scope.generation ||
      !previous.wasStreaming ||
      isStreaming ||
      status !== "ready"
    ) {
      return;
    }

    // 先保存已完成回复，避免空闲回调前切换笔记本而丢失旧会话。
    updateSessionMessages(scope, (currentMessages) =>
      ensureNotebookAiMessageCreatedAt(
        sanitizeNotebookAiMessages(currentMessages),
      ),
    );
    const persist = () => {
      // 空闲回调可能晚于审批／新消息；按原 scope 从 SDK 再读最新数组。
      // 切换后 updater 会同时拒绝读取新 Chat 和写入旧会话。
      updateSessionMessages(scope, (currentMessages) => currentMessages);
    };
    const ric = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      ric(persist, { timeout: 700 });
    } else {
      setTimeout(persist, 48);
    }
  }, [
    conversationId,
    currentSessionScope,
    isCurrentSession,
    isStreaming,
    messages,
    notebookId,
    sessionGeneration,
    updateSessionMessages,
    status,
  ]);

  const stopAll = useCallback(() => {
    compactAbortRef.current?.abort();
    void stop();
  }, [stop]);

  useEffect(() => {
    if (!isStreaming) return;
    const timer = window.setTimeout(() => {
      void committedStopRef.current();
      toast.error("AI 响应长时间没有更新，已停止本轮任务。", {
        id: "notebook-ai-stream-timeout",
        description: "已保留完成的步骤，可以直接重试。",
      });
    }, NOTEBOOK_AI_STREAM_IDLE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isStreaming, messages]);

  // 请求生命周期 → 页头图标：关面板/切页不打断；仅真实结束才 celebrate。
  useEffect(() => {
    if (isStreaming || isCompacting) {
      if (!aiStatusActiveRef.current) {
        aiStatusActiveRef.current = true;
        useAiStatus.getState().beginStreaming();
      }
      return;
    }

    if (!aiStatusActiveRef.current) return;
    aiStatusActiveRef.current = false;
    useAiStatus
      .getState()
      .finishStreaming({ celebrate: status === "ready" && !error });
  }, [error, isCompacting, isStreaming, status]);

  useEffect(() => {
    setMessages(
      useNotebookAiChats
        .getState()
        .getConversationMessages(notebookId, conversationId),
    );
    clearError();
    requestCurrentPageIdRef.current = null;
  }, [notebookId, conversationId, setMessages, clearError]);

  useEffect(() => {
    if (unavailableReason || isBusy || composerHasContent) return;

    let timer: number | null = null;
    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        setPlaceholderIndex(
          (index) => (index + 1) % NOTEBOOK_AI_PLACEHOLDER_HINTS.length,
        );
      }, 4500);
    };
    const sync = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [unavailableReason, isBusy, composerHasContent]);

  const persistCurrentConversation = useCallback(() => {
    useNotebookAiChats
      .getState()
      .setMessages(
        notebookId,
        conversationId,
        sanitizeNotebookAiMessages(messages),
      );
  }, [notebookId, conversationId, messages]);

  const send = useCallback(
    (
      payload: AiComposerPayload,
      imageAttachments: NotebookAiImageAttachment[],
      options?: {
        capturedSelection?: NotebookAiPanelSelectionCapture | null;
        onConsumeCapturedSelection?: () => void;
      },
    ) => {
      if (isBusy || unavailableReason) return false;

      const displayText = payload.promptText.trim();
      const hasQuotes =
        (payload.selectionQuotes?.length ?? 0) > 0 ||
        payload.tokens.some((token) => token.type === "selectionQuote");
      if (!displayText && imageAttachments.length === 0 && !hasQuotes)
        return false;
      const requestPayload = displayText
        ? payload
        : {
            ...payload,
            promptText: "请分析用户上传的图片。",
            freeformText: "",
          };

      const currentPageId = getCurrentNotebookAiPageId(notebookId);
      const { modelText, metadata } = buildNotebookAiUserMessage({
        payload: requestPayload,
        notebookId,
        currentPageId,
        useImplicitPage: false,
      });
      metadata.displayText = displayText || "已上传图片";
      metadata.createdAt = Date.now();
      metadata.imageAttachments = imageAttachments.map(({ file }) => ({
        filename: file.name,
        mediaType: file.type || "image/*",
      }));
      if (metadata.diagnostics) {
        metadata.diagnostics.imageCount = imageAttachments.length;
      }
      const cleanedMessages = sanitizeNotebookAiMessages(messages);
      const onConsumeCapturedSelection = options?.onConsumeCapturedSelection;

      requestCurrentPageIdRef.current = currentPageId;
      if (cleanedMessages !== messages) {
        setMessages(cleanedMessages);
        useNotebookAiChats
          .getState()
          .setMessages(notebookId, conversationId, cleanedMessages);
      }

      clearError();
      void sendMessage({
        text: modelText,
        files: createImageFileList(imageAttachments),
        metadata,
      });
      onConsumeCapturedSelection?.();
      return true;
    },
    [
      isBusy,
      unavailableReason,
      notebookId,
      conversationId,
      messages,
      setMessages,
      clearError,
      sendMessage,
    ],
  );

  const newConversation = useCallback(
    (options?: { onConsumeCapturedSelection?: () => void }) => {
      if (isBusy) return;
      persistCurrentConversation();
      clearError();
      requestCurrentPageIdRef.current = null;
      options?.onConsumeCapturedSelection?.();
      // 新会话清空输入草稿，避免把旧会话未发送内容带过去
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      const nextConversationId = useNotebookAiChats
        .getState()
        .createConversation(notebookId);
      setSuppressDefaultPageSeed(true);
      setComposerRevision((revision) => revision + 1);
      setConversationId(nextConversationId);
      setMessages([]);
    },
    [
      isBusy,
      persistCurrentConversation,
      clearError,
      notebookId,
      setConversationId,
      setMessages,
    ],
  );

  const compactConversation = useCallback(() => {
    if (
      isBusy ||
      (batchWorkRef.current.get(sessionScopeKey(currentSessionScope)) ?? 0) > 0
    ) {
      toast.warning("正在生成回复，请稍后再压缩");
      return;
    }
    if (unavailableReason) {
      toast.error(unavailableReason);
      return;
    }
    const currentMessages = messagesRef.current;
    if (!conversationHasCompactableContent(currentMessages)) {
      toast.info("当前会话为空，无需压缩");
      return;
    }

    compactAbortRef.current?.abort();
    const scope = currentSessionScope;
    const abort = new AbortController();
    compactAbortRef.current = abort;
    setIsCompacting(true);
    clearError();

    void generateConversationCompactSummary(currentMessages, abort.signal)
      .then((summary) => {
        if (abort.signal.aborted || !isCurrentSession(scope)) return;
        const compacted = ensureNotebookAiMessageCreatedAt(
          buildCompactedConversation({
            summary,
            createId: createChatMessageId,
          }),
        );
        setMessages(compacted);
        useNotebookAiChats
          .getState()
          .setMessages(notebookId, conversationId, compacted);
        toast.success("会话已压缩");
      })
      .catch((error) => {
        if (abort.signal.aborted || !isCurrentSession(scope)) return;
        toast.error("压缩失败", {
          description: formatNotebookAiError(error, { phase: "chat" }),
        });
      })
      .finally(() => {
        if (compactAbortRef.current === abort) {
          compactAbortRef.current = null;
        }
        if (isCurrentSession(scope)) {
          setIsCompacting(false);
        }
      });
  }, [
    clearError,
    conversationId,
    isBusy,
    isCurrentSession,
    notebookId,
    currentSessionScope,
    setMessages,
    unavailableReason,
  ]);

  const selectConversation = useCallback(
    (
      nextConversationId: string,
      options?: { onConsumeCapturedSelection?: () => void },
    ) => {
      if (isBusy || nextConversationId === conversationId) return;
      persistCurrentConversation();
      const chats = useNotebookAiChats.getState();
      chats.setActiveConversation(notebookId, nextConversationId);
      const nextMessages = chats.getConversationMessages(
        notebookId,
        nextConversationId,
      );
      clearError();
      requestCurrentPageIdRef.current = null;
      options?.onConsumeCapturedSelection?.();
      setSuppressDefaultPageSeed(false);
      setConversationId(nextConversationId);
      setMessages(nextMessages);
    },
    [
      isBusy,
      conversationId,
      notebookId,
      clearError,
      setConversationId,
      setMessages,
      persistCurrentConversation,
    ],
  );

  const deleteConversation = useCallback(
    (targetConversationId: string) => {
      // 流式中只拒绝删除当前激活会话，删除其他历史会话不受影响
      if (isBusy && targetConversationId === conversationId) {
        toast.warning("正在生成回复，请稍后再删除当前会话");
        return false;
      }

      const chats = useNotebookAiChats.getState();
      if (targetConversationId !== conversationId) {
        // 非激活会话：只删记录，不影响当前会话内容
        chats.deleteConversation(notebookId, targetConversationId);
        return true;
      }

      // 删除激活会话：不要 persistCurrentConversation（会把内存消息写回刚要删的会话）
      chats.deleteConversation(notebookId, targetConversationId);
      clearError();
      requestCurrentPageIdRef.current = null;

      const nextActiveConversationId = useNotebookAiChats
        .getState()
        .getActiveConversationId(notebookId);
      if (nextActiveConversationId) {
        const nextMessages = useNotebookAiChats
          .getState()
          .getConversationMessages(notebookId, nextActiveConversationId);
        setSuppressDefaultPageSeed(false);
        setConversationId(nextActiveConversationId);
        setMessages(nextMessages);
        return true;
      }

      // 无剩余会话：与新建会话一致，落到空白新会话
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      const freshConversationId = useNotebookAiChats
        .getState()
        .createConversation(notebookId);
      setSuppressDefaultPageSeed(true);
      setComposerRevision((revision) => revision + 1);
      setConversationId(freshConversationId);
      setMessages([]);
      return true;
    },
    [
      isBusy,
      conversationId,
      notebookId,
      clearError,
      setConversationId,
      setMessages,
    ],
  );

  const searchPages = useCallback(
    (query: string) => getNotebookAiReferenceSuggestions(query, notebookId),
    [notebookId],
  );

  const onBatchApproval = useCallback(
    async (response: BatchApprovalResponse) => {
      const scope = currentSessionScope;
      if (!isCurrentSession(scope)) return;
      if (compactAbortRef.current && !compactAbortRef.current.signal.aborted) {
        toast.warning("正在压缩会话，请稍后再执行批量计划");
        return;
      }
      const replaceToolPart = (
        state: BatchApprovalToolState,
        payload: { output?: unknown; errorText?: string } = {},
      ) => {
        updateSessionMessages(scope, (currentMessages) =>
          sanitizeNotebookAiMessages(
            replaceBatchApprovalToolParts(
              currentMessages,
              response,
              state,
              payload,
            ),
          ),
        );
      };

      if (!response.approved) {
        replaceToolPart("output-denied");
        return;
      }

      const journal = updateBatchPlanSelection(
        response.toolCallId,
        response.runId,
        response.selectedOperationIds,
      );
      if (!journal) {
        toast.error("批量计划已失效，请让 AI 重新生成计划。");
        return;
      }

      const finishBatchWork = beginBatchWork(scope);
      replaceToolPart("approval-responded");
      try {
        const result = await executePreparedBatchPlan(
          response.toolCallId,
          response.runId,
        );
        const appliedCount = result.results.filter((item) => item.ok).length;
        replaceToolPart("output-available", {
          output: {
            ok: result.ok,
            toolCallId: response.toolCallId,
            runId: response.runId,
            status: result.journal.status,
            appliedCount,
            selectedCount: result.journal.selectedOperationIds.length,
            canUndo: result.ok && result.journal.status === "completed",
            ...(result.ok ? {} : { error: result.error }),
            results: result.results,
          },
        });
      } catch (executeError) {
        replaceToolPart("output-error", {
          errorText:
            executeError instanceof Error
              ? executeError.message
              : "批量计划执行失败",
        });
      } finally {
        finishBatchWork();
      }
    },
    [
      beginBatchWork,
      currentSessionScope,
      isCurrentSession,
      updateSessionMessages,
    ],
  );

  const onBatchUndo = useCallback(
    async (toolCallId: string, runId: string): Promise<BatchUndoResult> => {
      const scope = currentSessionScope;
      if (!isCurrentSession(scope)) {
        return { ok: false, error: "会话已切换，已忽略过期结果" };
      }
      if (compactAbortRef.current && !compactAbortRef.current.signal.aborted) {
        return { ok: false, error: "正在压缩会话，请稍后再撤回" };
      }
      const finishBatchWork = beginBatchWork(scope);
      try {
        const result = await undoBatchPlan(toolCallId, runId);
        if (!isCurrentSession(scope)) {
          return { ok: false, error: "会话已切换，已忽略过期结果" };
        }
        if (!result.ok) {
          toast.error("无法完整撤回本批变更", {
            description: formatNotebookAiError(result.error, { phase: "undo" }),
          });
          return {
            ok: false,
            status: result.journal.status,
            conflictCount: result.journal.status === "undo-conflicted" ? 1 : 0,
            error: result.error,
          };
        }

        const pageIds = new Set(
          result.results.flatMap((operation) => operation.pageIds),
        );
        pageIds.forEach(reloadEditorIfActive);
        updateSessionMessages(scope, (currentMessages) =>
          sanitizeNotebookAiMessages(
            markBatchUndoToolParts(currentMessages, toolCallId),
          ),
        );
        toast.success("已撤回本批变更");
        return {
          ok: true,
          status: "reverted",
          revertedCount: result.results.filter((operation) => operation.ok)
            .length,
        };
      } catch (undoError) {
        if (!isCurrentSession(scope)) {
          return { ok: false, error: "会话已切换，已忽略过期结果" };
        }
        const description = formatNotebookAiError(undoError, { phase: "undo" });
        toast.error("撤回失败", { description });
        return { ok: false, error: description };
      } finally {
        finishBatchWork();
      }
    },
    [
      beginBatchWork,
      currentSessionScope,
      isCurrentSession,
      updateSessionMessages,
    ],
  );

  const value = useMemo<NotebookAiSessionValue>(
    () => ({
      notebookId,
      conversationId,
      messages,
      status,
      error,
      clearError,
      stop: stopAll,
      isStreaming,
      isBusy,
      unavailableReason,
      placeholderIndex,
      composerRevision,
      suppressDefaultPageSeed,
      send,
      newConversation,
      compactConversation,
      selectConversation,
      deleteConversation,
      searchPages,
      onBatchApproval,
      onBatchUndo,
    }),
    [
      notebookId,
      conversationId,
      messages,
      status,
      error,
      clearError,
      stopAll,
      isStreaming,
      isBusy,
      unavailableReason,
      placeholderIndex,
      composerRevision,
      suppressDefaultPageSeed,
      send,
      newConversation,
      compactConversation,
      selectConversation,
      deleteConversation,
      searchPages,
      onBatchApproval,
      onBatchUndo,
    ],
  );

  return (
    <NotebookAiAssistantRuntimeProvider
      messages={messages}
      isRunning={isBusy}
      isDisabled={Boolean(unavailableReason)}
      onCancel={stopAll}
    >
      <NotebookAiSessionContext.Provider value={value}>
        {children}
      </NotebookAiSessionContext.Provider>
    </NotebookAiAssistantRuntimeProvider>
  );
}
