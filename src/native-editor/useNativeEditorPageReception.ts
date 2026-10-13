import { useCallback } from "react";
import { createRequestID, isValidEnvelope } from "./bridge";
import { nativeAssetBridge, nativeResourceBridge } from "./runtime";
import { nativeAITransportBridge } from "./aiTransportStub";
import { invalidateAISelections } from "./aiSelectionBridge";
import { parseNativeMarkdown, type ParsedNativeMarkdown } from "./markdown";
import type { EditorPageInput } from "./types";
import { createNativePage } from "./nativeEditorDefinitions";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorPageReception({
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
}: Pick<NativeEditorBindings,
  "generationRef" | "beginPageReadiness" | "applyingHostPageRef" | "setIsLoadingPage" |
  "setCurrentPage" | "saveTimerRef" | "pageIDRef" | "revisionRef" | "titleRef" | "originalMarkdownRef" |
  "repairCandidateRef" | "acceptedRepairMarkdownRef" | "dirtyVersionRef" | "lastSentDirtyVersionRef" |
  "pendingRequestRef" | "pendingMarkdownRef" | "flushedDraftRef" | "composingRef" |
  "compositionWaitersRef" | "pendingWaitersRef" | "setRepairDeclined" | "setSaveState" |
  "setErrorMessage" | "applyPreferences" | "pageLoadTokenRef" | "setCommittedPageToken" |
  "setEditorGeneration" | "modeRef" | "profileRef" | "frontmatterRef" | "setMode" | "focusEditor"
>) {

  const receivePage = useCallback(
    async (input: EditorPageInput) => {
      const normalized = {
        ...input,
        requestID:
          input.requestID ??
          (window.webkit?.messageHandlers?.gooseNotes ? "" : createRequestID()),
      };
      if (
        !isValidEnvelope(normalized) ||
        !normalized.pageID ||
        normalized.generation < generationRef.current
      )
        return;
      generationRef.current = normalized.generation;
      const readiness = beginPageReadiness(normalized.generation);
      applyingHostPageRef.current = true;
      setIsLoadingPage(true);
      setCurrentPage(null);
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      nativeResourceBridge.invalidate();
      nativeAssetBridge.invalidate();
      nativeAITransportBridge.invalidate();
      invalidateAISelections();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      pageIDRef.current = normalized.pageID;
      revisionRef.current = normalized.revision;
      titleRef.current = normalized.title;
      originalMarkdownRef.current = normalized.markdown;
      repairCandidateRef.current = null;
      acceptedRepairMarkdownRef.current = "";
      dirtyVersionRef.current = 0;
      lastSentDirtyVersionRef.current = 0;
      pendingRequestRef.current = null;
      pendingMarkdownRef.current = "";
      flushedDraftRef.current = null;
      composingRef.current = false;
      compositionWaitersRef.current.splice(0).forEach((resolve) => resolve());
      pendingWaitersRef.current.splice(0).forEach((waiter) => {
        waiter.reject(new Error("当前文件已切换，旧保存请求已取消。"));
      });
      window.__gooseBridgeContext = {
        pageID: normalized.pageID,
        revision: normalized.revision,
      };
      setRepairDeclined(false);
      setSaveState("idle");
      setErrorMessage("");
      applyPreferences(normalized);

      let parsed: ParsedNativeMarkdown;
      try {
        parsed = await parseNativeMarkdown(normalized.markdown);
      } catch {
        parsed = {
          status: "unavailable",
          blocks: null,
          frontmatter: null,
          profile: null,
        };
      }
      if (
        readiness.token !== pageLoadTokenRef.current ||
        normalized.generation !== generationRef.current
      )
        return;
      // The visible shell and the editor key carry this exact load token so the
      // readiness check cannot accept an editor left over from another request.
      setCommittedPageToken(readiness.token);
      setEditorGeneration(readiness.token);
      if (parsed.status === "editable") {
        modeRef.current = "blocks";
        profileRef.current = parsed.profile;
        frontmatterRef.current = parsed.frontmatter;
        setMode("blocks");
        setCurrentPage(
          createNativePage(normalized, parsed.blocks, normalized.editorFont),
        );
      } else if (parsed.status === "repairable") {
        modeRef.current = "repair-required";
        profileRef.current = null;
        frontmatterRef.current = null;
        repairCandidateRef.current = {
          generation: normalized.generation,
          input: normalized,
          blocks: parsed.blocks,
          frontmatter: parsed.frontmatter,
          profile: parsed.profile,
          normalizedMarkdown: parsed.normalizedMarkdown,
        };
        setMode("repair-required");
        setCurrentPage(null);
      } else {
        modeRef.current = "unavailable";
        profileRef.current = null;
        frontmatterRef.current = null;
        setMode("unavailable");
        setCurrentPage(null);
      }
      setIsLoadingPage(false);
      await readiness.promise;
      if (normalized.generation === generationRef.current) focusEditor();
    },
    [applyPreferences, beginPageReadiness, focusEditor, setCurrentPage],
  );

  return { receivePage };
}
