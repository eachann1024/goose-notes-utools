import { useCallback } from "react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { createRequestID, isValidEnvelope, postToHost } from "./bridge";
import { serializeNativeMarkdown } from "./markdown";
import type { EditorDraft, SaveAcknowledgement } from "./types";
import { type PendingWaiter, type PageIdentity } from "./nativeEditorDefinitions";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorDrafts({
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
}: Pick<NativeEditorBindings,
  "currentPageIdentity" | "matchesPageIdentity" | "revisionRef" | "titleRef" | "originalMarkdownRef" |
  "modeRef" | "editorRef" | "profileRef" | "frontmatterRef" | "acceptedRepairMarkdownRef" |
  "pageIDRef" | "pendingRequestRef" | "composingRef" | "saveTimerRef" | "setSaveState" |
  "pendingMarkdownRef" | "lastSentDirtyVersionRef" | "dirtyVersionRef" | "commitDraftRef" |
  "applyingHostPageRef" | "pendingWaitersRef" | "compositionWaitersRef"
>) {

  const buildDraft = useCallback(
    async (expectedIdentity?: PageIdentity): Promise<EditorDraft> => {
      const identity = expectedIdentity ?? currentPageIdentity();
      if (!identity || !matchesPageIdentity(identity)) {
        throw new Error("编辑器桥接上下文已失效。");
      }
      const revision = revisionRef.current;
      const title = titleRef.current;
      const originalMarkdown = originalMarkdownRef.current;
      const currentMode = modeRef.current;
      let markdown: string;
      if (currentMode !== "blocks") {
        markdown = originalMarkdown;
      } else {
        const editor = editorRef.current?.editor;
        const profile = profileRef.current;
        const frontmatter = frontmatterRef.current;
        const acceptedRepairMarkdown = acceptedRepairMarkdownRef.current;
        if (!editor || !profile) {
          if (acceptedRepairMarkdown) {
            markdown = acceptedRepairMarkdown;
          } else {
            throw new Error("块编辑器尚未准备好，无法提交草稿。");
          }
        } else {
          markdown = await serializeNativeMarkdown(
            editor.document as BlockNoteContent,
            frontmatter,
            profile,
          );
        }
      }
      if (!matchesPageIdentity(identity) || revisionRef.current !== revision) {
        throw new Error("编辑器桥接上下文已失效。");
      }
      const hasChanges = markdown !== originalMarkdown;
      return {
        version: 1,
        requestID: createRequestID(),
        pageID: identity.pageID,
        revision,
        baseRevision: revision,
        title,
        markdown,
        hasChanges,
      };
    },
    [currentPageIdentity, matchesPageIdentity],
  );

  const commitDraft = useCallback(async () => {
    if (!pageIDRef.current || pendingRequestRef.current || composingRef.current)
      return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const draft = await buildDraft();
    if (!draft.hasChanges) {
      setSaveState("idle");
      return;
    }
    pendingRequestRef.current = draft.requestID;
    pendingMarkdownRef.current = draft.markdown;
    lastSentDirtyVersionRef.current = dirtyVersionRef.current;
    setSaveState("saving");
    postToHost({ ...draft, type: "change" });
  }, [buildDraft]);
  commitDraftRef.current = commitDraft;

  const markDirty = useCallback(() => {
    if (!pageIDRef.current || applyingHostPageRef.current) return;
    dirtyVersionRef.current += 1;
    setSaveState("saving");
    postToHost({
      version: 1,
      type: "dirty",
      requestID: createRequestID(),
      pageID: pageIDRef.current,
      revision: revisionRef.current,
    });
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(
      () => void commitDraftRef.current(),
      360,
    );
  }, []);

  const waitForPending = useCallback(async () => {
    if (!pendingRequestRef.current) return;
    await new Promise<void>((resolve, reject) => {
      const waiter: PendingWaiter = {
        resolve: () => {
          window.clearTimeout(waiter.timeout);
          resolve();
        },
        reject: (error) => {
          window.clearTimeout(waiter.timeout);
          reject(error);
        },
        timeout: 0,
      };
      waiter.timeout = window.setTimeout(() => {
        pendingWaitersRef.current = pendingWaitersRef.current.filter(
          (candidate) => candidate !== waiter,
        );
        reject(new Error("等待保存确认超时，已停止切换以保护当前编辑。"));
      }, 10_000);
      pendingWaitersRef.current.push(waiter);
    });
  }, []);

  const finishComposition = useCallback(async () => {
    if (!composingRef.current) return;
    await new Promise<void>((resolve, reject) => {
      let timeout = 0;
      const settle = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      timeout = window.setTimeout(() => {
        compositionWaitersRef.current = compositionWaitersRef.current.filter(
          (candidate) => candidate !== settle,
        );
        reject(new Error("输入法组合尚未结束，已停止切换以保护当前输入。"));
      }, 2_000);
      compositionWaitersRef.current.push(settle);
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) activeElement.blur();
      if (!composingRef.current) queueMicrotask(settle);
    });
  }, []);

  return { buildDraft, commitDraft, markDirty, waitForPending, finishComposition };
}

export function useNativeEditorAcknowledgement({
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
}: Pick<NativeEditorBindings,
  "pageIDRef" | "pendingRequestRef" | "flushedDraftRef" | "pendingMarkdownRef" |
  "lastSentDirtyVersionRef" | "pendingWaitersRef" | "revisionRef" | "dirtyVersionRef" |
  "originalMarkdownRef" | "setSaveState" | "setErrorMessage" | "saveTimerRef" | "commitDraftRef"
>) {

  const receiveAcknowledgement = useCallback(
    (acknowledgement: SaveAcknowledgement) => {
      if (
        !isValidEnvelope(acknowledgement) ||
        acknowledgement.pageID !== pageIDRef.current
      )
        return;
      const isPendingSave =
        acknowledgement.requestID === pendingRequestRef.current;
      const flushedDraft =
        flushedDraftRef.current?.requestID === acknowledgement.requestID
          ? flushedDraftRef.current
          : null;
      if (!isPendingSave && !flushedDraft) return;
      const sentMarkdown = flushedDraft?.markdown ?? pendingMarkdownRef.current;
      const sentDirtyVersion =
        flushedDraft?.dirtyVersion ?? lastSentDirtyVersionRef.current;
      if (isPendingSave) pendingRequestRef.current = null;
      if (flushedDraft) flushedDraftRef.current = null;
      if (isPendingSave) {
        pendingWaitersRef.current
          .splice(0)
          .forEach((waiter) => waiter.resolve());
      }

      if (acknowledgement.status === "saved") {
        revisionRef.current = acknowledgement.revision;
        window.__gooseBridgeContext = {
          pageID: acknowledgement.pageID,
          revision: acknowledgement.revision,
        };
        const changedAfterSend = dirtyVersionRef.current !== sentDirtyVersion;
        originalMarkdownRef.current = sentMarkdown;
        if (!changedAfterSend) {
          dirtyVersionRef.current = 0;
          lastSentDirtyVersionRef.current = 0;
        }
        setSaveState(changedAfterSend ? "saving" : "saved");
        setErrorMessage("");
        if (changedAfterSend) {
          saveTimerRef.current = window.setTimeout(
            () => void commitDraftRef.current(),
            120,
          );
        }
        return;
      }

      setErrorMessage(acknowledgement.message ?? "保存失败，请重试。");
      setSaveState(
        acknowledgement.status === "conflict" ? "conflict" : "failed",
      );
    },
    [],
  );

  return { receiveAcknowledgement };
}
