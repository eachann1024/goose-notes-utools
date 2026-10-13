import type { Page } from "@/types";
import { type EditorSettings } from "@/components/editor/platform/hostContext";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { type MarkdownSerializationProfile } from "./markdown";
import type { EditorPageInput, NativeEditorFont } from "./types";

export type SaveVisualState = "idle" | "saving" | "saved" | "failed" | "conflict";

export const EDITOR_FONT_SIZE_DEFAULT = 16;

export const EDITOR_FONT_SIZE_MIN = 12;

export const EDITOR_FONT_SIZE_MAX = 24;

export function normalizeEditorFontSize(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return EDITOR_FONT_SIZE_DEFAULT;
  return Math.min(
    EDITOR_FONT_SIZE_MAX,
    Math.max(EDITOR_FONT_SIZE_MIN, numeric),
  );
}

export interface FlushedDraftSnapshot {
  requestID: string;
  markdown: string;
  dirtyVersion: number;
}

export interface PendingWaiter {
  resolve(): void;
  reject(error: Error): void;
  timeout: number;
}

export interface PageReadyBarrier {
  token: number;
  generation: number;
  settled: boolean;
  timeout: number;
  promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
}

export interface PageIdentity {
  token: number;
  generation: number;
  pageID: string;
}

export interface RepairCandidate {
  generation: number;
  input: EditorPageInput;
  blocks: BlockNoteContent;
  frontmatter: string | null;
  profile: MarkdownSerializationProfile;
  normalizedMarkdown: string;
}

export const EMPTY_AI_SETTINGS = {
  // 入口始终可见；未配置原生服务时 transport 会返回可操作的配置提示，且不会联网。
  enabled: true,
  selectedModelId: null,
  workspaceSelectedModelId: null,
  workspaceReasoningLevel: "medium",
  customProtocol: "openai",
  customOpenAIResponsesBaseURL: "",
  customOpenAIBaseURL: "",
  customClaudeBaseURL: "",
  customOpenAIResponsesApiKey: "",
  customOpenAIApiKey: "",
  customClaudeApiKey: "",
  customModelOptions: [],
} as unknown as EditorSettings["ai"];

export function createNativePage(
  payload: EditorPageInput,
  content: BlockNoteContent,
  font: NativeEditorFont,
): Page {
  const now = Date.now();
  return {
    id: payload.pageID,
    workspaceId: "native-macos",
    content,
    isLocked: false,
    fontSize: "default",
    fontFamily: font === "sans" ? "default" : font,
    localFilePath: payload.pageID,
    localReadState: "ready",
    createdAt: now,
    updatedAt: now,
  };
}
