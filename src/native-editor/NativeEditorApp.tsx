import { useRef, useState } from "react";
import type { Page } from "@/types";
import { type EditorRef } from "@/components/editor/core/Editor";
import { type MarkdownSerializationProfile } from "./markdown";
import type { NativeEditorAppearance, NativeEditorFont, NativeEditorMode } from "./types";
import { type SaveVisualState, EDITOR_FONT_SIZE_DEFAULT, type FlushedDraftSnapshot, type PendingWaiter, type PageReadyBarrier, type RepairCandidate } from "./nativeEditorDefinitions";
import { useNativeEditorPageLifecycle } from "./useNativeEditorPageLifecycle";
import { useNativeEditorPreferences, useNativeEditorAIEntry } from "./useNativeEditorAppearance";
import { useNativeEditorDrafts, useNativeEditorAcknowledgement } from "./useNativeEditorDrafts";
import { useNativeEditorPageReception } from "./useNativeEditorPageReception";
import { useNativeEditorCommands } from "./useNativeEditorCommands";
import { useNativeEditorHostBridge } from "./useNativeEditorHostBridge";
import { useNativeEditorContexts } from "./useNativeEditorContexts";
import { useNativeEditorRepair } from "./useNativeEditorRepair";
import { renderNativeEditorSurface } from "./nativeEditorSurface";

export function NativeEditorApp() {
  const editorRef = useRef<EditorRef>(null);
  const primaryGateActionRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [mode, setMode] = useState<NativeEditorMode>("blocks");
  const [repairDeclined, setRepairDeclined] = useState(false);
  const [appearance, setAppearance] = useState<NativeEditorAppearance>("light");
  const [font, setFont] = useState<NativeEditorFont>("sans");
  const [fontSize, setFontSize] = useState(EDITOR_FONT_SIZE_DEFAULT);
  const [fullWidth, setFullWidth] = useState(false);
  const [saveState, setSaveState] = useState<SaveVisualState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aiUnavailableMessage, setAIUnavailableMessage] = useState("");
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [committedPageToken, setCommittedPageToken] = useState(0);

  const pageRef = useRef<Page | null>(null);
  const pageIDRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const generationRef = useRef(0);
  const titleRef = useRef("");
  const originalMarkdownRef = useRef("");
  const modeRef = useRef<NativeEditorMode>("blocks");
  const profileRef = useRef<MarkdownSerializationProfile | null>(null);
  const frontmatterRef = useRef<string | null>(null);
  const repairCandidateRef = useRef<RepairCandidate | null>(null);
  const acceptedRepairMarkdownRef = useRef("");
  const dirtyVersionRef = useRef(0);
  const lastSentDirtyVersionRef = useRef(0);
  const pendingRequestRef = useRef<string | null>(null);
  const pendingMarkdownRef = useRef("");
  const flushedDraftRef = useRef<FlushedDraftSnapshot | null>(null);
  const pendingWaitersRef = useRef<PendingWaiter[]>([]);
  const pageReadyBarrierRef = useRef<PageReadyBarrier | null>(null);
  const pageLoadTokenRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const commitDraftRef = useRef<() => Promise<void>>(async () => undefined);
  const composingRef = useRef(false);
  const compositionWaitersRef = useRef<Array<() => void>>([]);
  const applyingHostPageRef = useRef(false);
  const readyPostedRef = useRef(false);

  const { setCurrentPage, focusEditor, beginPageReadiness, currentPageIdentity, matchesPageIdentity, matchesCurrentEnvelope } = useNativeEditorPageLifecycle({
    pageRef,
    setPage,
    modeRef,
    primaryGateActionRef,
    profileRef,
    editorRef,
    pageReadyBarrierRef,
    pageLoadTokenRef,
    applyingHostPageRef,
    generationRef,
    committedPageToken,
    isLoadingPage,
    mode,
    page,
    pageIDRef,
    revisionRef,
  });

  const { applyPreferences } = useNativeEditorPreferences({
    matchesCurrentEnvelope,
    setAppearance,
    setFont,
    setFontSize,
    setFullWidth,
    pageRef,
    setCurrentPage,
  });

  const { buildDraft, commitDraft, markDirty, waitForPending, finishComposition } = useNativeEditorDrafts({
    currentPageIdentity,
    matchesPageIdentity,
    revisionRef,
    titleRef,
    originalMarkdownRef,
    modeRef,
    editorRef,
    profileRef,
    frontmatterRef,
    acceptedRepairMarkdownRef,
    pageIDRef,
    pendingRequestRef,
    composingRef,
    saveTimerRef,
    setSaveState,
    pendingMarkdownRef,
    lastSentDirtyVersionRef,
    dirtyVersionRef,
    commitDraftRef,
    applyingHostPageRef,
    pendingWaitersRef,
    compositionWaitersRef,
  });

  const { receivePage } = useNativeEditorPageReception({
    generationRef,
    beginPageReadiness,
    applyingHostPageRef,
    setIsLoadingPage,
    setCurrentPage,
    saveTimerRef,
    pageIDRef,
    revisionRef,
    titleRef,
    originalMarkdownRef,
    repairCandidateRef,
    acceptedRepairMarkdownRef,
    dirtyVersionRef,
    lastSentDirtyVersionRef,
    pendingRequestRef,
    pendingMarkdownRef,
    flushedDraftRef,
    composingRef,
    compositionWaitersRef,
    pendingWaitersRef,
    setRepairDeclined,
    setSaveState,
    setErrorMessage,
    applyPreferences,
    pageLoadTokenRef,
    setCommittedPageToken,
    setEditorGeneration,
    modeRef,
    profileRef,
    frontmatterRef,
    setMode,
    focusEditor,
  });

  const { receiveAcknowledgement } = useNativeEditorAcknowledgement({
    pageIDRef,
    pendingRequestRef,
    flushedDraftRef,
    pendingMarkdownRef,
    lastSentDirtyVersionRef,
    pendingWaitersRef,
    revisionRef,
    dirtyVersionRef,
    originalMarkdownRef,
    setSaveState,
    setErrorMessage,
    saveTimerRef,
    commitDraftRef,
  });

  const { dispatchCommand, applyNativeAISelection } = useNativeEditorCommands({
    matchesCurrentEnvelope,
    modeRef,
    editorRef,
  });

  useNativeEditorHostBridge({
    matchesCurrentEnvelope,
    saveTimerRef,
    pageIDRef,
    revisionRef,
    titleRef,
    originalMarkdownRef,
    profileRef,
    frontmatterRef,
    repairCandidateRef,
    acceptedRepairMarkdownRef,
    dirtyVersionRef,
    lastSentDirtyVersionRef,
    pendingRequestRef,
    pendingMarkdownRef,
    flushedDraftRef,
    pageReadyBarrierRef,
    pageLoadTokenRef,
    applyingHostPageRef,
    composingRef,
    compositionWaitersRef,
    pendingWaitersRef,
    setCurrentPage,
    setRepairDeclined,
    setMode,
    setIsLoadingPage,
    setCommittedPageToken,
    setSaveState,
    setErrorMessage,
    receivePage,
    receiveAcknowledgement,
    applyPreferences,
    dispatchCommand,
    applyNativeAISelection,
    focusEditor,
    currentPageIdentity,
    matchesPageIdentity,
    finishComposition,
    modeRef,
    waitForPending,
    buildDraft,
    readyPostedRef,
  });

  const { settings, pageContext } = useNativeEditorContexts({
    appearance,
    fontSize,
    fullWidth,
    page,
    applyingHostPageRef,
    pageRef,
    setCurrentPage,
    markDirty,
    pageIDRef,
  });

  const retry = () => {
    setErrorMessage("");
    setSaveState("saving");
    void commitDraft();
  };

  useNativeEditorAIEntry({
    setAIUnavailableMessage,
  });

  const { reload, acceptRepair, keepOriginal } = useNativeEditorRepair({
    pageIDRef,
    revisionRef,
    repairCandidateRef,
    modeRef,
    generationRef,
    beginPageReadiness,
    applyingHostPageRef,
    profileRef,
    frontmatterRef,
    acceptedRepairMarkdownRef,
    setRepairDeclined,
    setMode,
    setCommittedPageToken,
    setEditorGeneration,
    setCurrentPage,
    font,
    fontSize,
    fullWidth,
    pageLoadTokenRef,
    markDirty,
    focusEditor,
    pageReadyBarrierRef,
    primaryGateActionRef,
  });

  return renderNativeEditorSurface({
    appearance,
    font,
    fontSize,
    mode,
    isLoadingPage,
    committedPageToken,
    composingRef,
    compositionWaitersRef,
    pageIDRef,
    saveState,
    errorMessage,
    reload,
    retry,
    aiUnavailableMessage,
    setAIUnavailableMessage,
    repairDeclined,
    primaryGateActionRef,
    acceptRepair,
    keepOriginal,
    page,
    pageContext,
    settings,
    editorGeneration,
    editorRef,
  });
}
