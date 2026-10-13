import { useCallback, useEffect } from "react";
import { createRequestID, postToHost } from "./bridge";
import { nativeAssetBridge, nativeResourceBridge } from "./runtime";
import { nativeAITransportBridge } from "./aiTransportStub";
import { applyAISelection, invalidateAISelections } from "./aiSelectionBridge";
import type { BridgeEnvelope } from "./types";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorHostBridge({
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
}: Pick<NativeEditorBindings,
  "matchesCurrentEnvelope" | "saveTimerRef" | "pageIDRef" | "revisionRef" | "titleRef" |
  "originalMarkdownRef" | "profileRef" | "frontmatterRef" | "repairCandidateRef" |
  "acceptedRepairMarkdownRef" | "dirtyVersionRef" | "lastSentDirtyVersionRef" | "pendingRequestRef" |
  "pendingMarkdownRef" | "flushedDraftRef" | "pageReadyBarrierRef" | "pageLoadTokenRef" |
  "applyingHostPageRef" | "composingRef" | "compositionWaitersRef" | "pendingWaitersRef" |
  "setCurrentPage" | "setRepairDeclined" | "setMode" | "setIsLoadingPage" | "setCommittedPageToken" |
  "setSaveState" | "setErrorMessage" | "receivePage" | "receiveAcknowledgement" | "applyPreferences" |
  "dispatchCommand" | "applyNativeAISelection" | "focusEditor" | "currentPageIdentity" |
  "matchesPageIdentity" | "finishComposition" | "modeRef" | "waitForPending" | "buildDraft" |
  "readyPostedRef"
>) {

  const clear = useCallback(
    (envelope: BridgeEnvelope) => {
      if (!matchesCurrentEnvelope(envelope)) return;
      nativeResourceBridge.invalidate();
      nativeAssetBridge.invalidate();
      nativeAITransportBridge.invalidate();
      invalidateAISelections();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      pageIDRef.current = null;
      revisionRef.current = 0;
      titleRef.current = "";
      originalMarkdownRef.current = "";
      profileRef.current = null;
      frontmatterRef.current = null;
      repairCandidateRef.current = null;
      acceptedRepairMarkdownRef.current = "";
      dirtyVersionRef.current = 0;
      lastSentDirtyVersionRef.current = 0;
      pendingRequestRef.current = null;
      pendingMarkdownRef.current = "";
      flushedDraftRef.current = null;
      const readiness = pageReadyBarrierRef.current;
      if (readiness && !readiness.settled) {
        window.clearTimeout(readiness.timeout);
        readiness.settled = true;
        readiness.reject(new Error("编辑器已清空，页面装载已取消。"));
      }
      pageReadyBarrierRef.current = null;
      pageLoadTokenRef.current += 1;
      applyingHostPageRef.current = false;
      composingRef.current = false;
      compositionWaitersRef.current.splice(0).forEach((resolve) => resolve());
      pendingWaitersRef.current.splice(0).forEach((waiter) => {
        waiter.reject(new Error("编辑器已清空，保存请求已取消。"));
      });
      window.__gooseBridgeContext = { pageID: "", revision: 0 };
      setCurrentPage(null);
      setRepairDeclined(false);
      setMode("blocks");
      setIsLoadingPage(false);
      setCommittedPageToken(0);
      setSaveState("idle");
      setErrorMessage("");
    },
    [matchesCurrentEnvelope, setCurrentPage],
  );

  useEffect(() => {
    window.gooseEditor = {
      receivePage,
      receiveAcknowledgement,
      receiveLocalResource: nativeResourceBridge.receive,
      receiveLocalAsset: nativeAssetBridge.receive,
      receiveAIResult: nativeAITransportBridge.receiveResult,
      receiveAIDelta: nativeAITransportBridge.receiveDelta,
      updatePreferences: applyPreferences,
      clear,
      dispatchCommand,
      applyAISelection: applyNativeAISelection,
      focusEditor: (envelope) => {
        if (matchesCurrentEnvelope(envelope)) focusEditor();
      },
      flushAndGetDraft: async (envelope) => {
        const normalizedEnvelope =
          envelope ??
          (window.webkit?.messageHandlers?.gooseNotes
            ? undefined
            : {
                version: 1 as const,
                requestID: createRequestID(),
                ...(window.__gooseBridgeContext ?? { pageID: "", revision: 0 }),
              });
        if (
          !normalizedEnvelope ||
          !matchesCurrentEnvelope(normalizedEnvelope) ||
          !pageIDRef.current
        ) {
          throw new Error("编辑器桥接上下文已失效。");
        }
        const identity = currentPageIdentity();
        if (!identity) throw new Error("编辑器桥接上下文已失效。");
        const readiness = pageReadyBarrierRef.current;
        if (readiness?.token === identity.token) {
          await readiness.promise;
        }
        if (!matchesPageIdentity(identity) || applyingHostPageRef.current) {
          throw new Error("编辑器桥接上下文已失效。");
        }
        await finishComposition();
        if (!matchesPageIdentity(identity)) {
          throw new Error("编辑器桥接上下文已失效。");
        }
        if (modeRef.current === "blocks") {
          window.dispatchEvent(
            new CustomEvent("goose-note:flush-editor", {
              detail: { immediate: true },
            }),
          );
        }
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        await waitForPending();
        if (!matchesPageIdentity(identity)) {
          throw new Error("编辑器桥接上下文已失效。");
        }
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const draft = await buildDraft(identity);
        flushedDraftRef.current = {
          requestID: draft.requestID,
          markdown: draft.markdown,
          dirtyVersion: dirtyVersionRef.current,
        };
        if (draft.hasChanges) setSaveState("saving");
        return draft;
      },
    };
    if (!readyPostedRef.current) {
      readyPostedRef.current = true;
      window.__gooseBridgeContext = { pageID: "", revision: 0 };
      postToHost({
        version: 1,
        type: "ready",
        requestID: createRequestID(),
        pageID: "",
        revision: 0,
      });
    }
  }, [
    applyPreferences,
    applyNativeAISelection,
    buildDraft,
    clear,
    dispatchCommand,
    focusEditor,
    finishComposition,
    currentPageIdentity,
    matchesCurrentEnvelope,
    matchesPageIdentity,
    receiveAcknowledgement,
    receivePage,
    waitForPending,
  ]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const readiness = pageReadyBarrierRef.current;
      if (readiness && !readiness.settled) {
        window.clearTimeout(readiness.timeout);
        readiness.settled = true;
        readiness.reject(new Error("编辑器已关闭，页面装载已取消。"));
      }
      pageReadyBarrierRef.current = null;
      pageLoadTokenRef.current += 1;
      compositionWaitersRef.current.splice(0).forEach((resolve) => resolve());
      pendingWaitersRef.current.splice(0).forEach((waiter) => {
        waiter.reject(new Error("编辑器已关闭，保存请求已取消。"));
      });
      nativeResourceBridge.invalidate();
      nativeAssetBridge.invalidate();
      nativeAITransportBridge.invalidate();
    },
    [],
  );
}
