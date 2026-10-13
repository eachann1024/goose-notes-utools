import { useCallback, useLayoutEffect } from "react";
import type { Page } from "@/types";
import { isValidEnvelope } from "./bridge";
import type { BridgeEnvelope } from "./types";
import { type PageReadyBarrier, type PageIdentity } from "./nativeEditorDefinitions";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorPageLifecycle({
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
}: Pick<NativeEditorBindings,
  "pageRef" | "setPage" | "modeRef" | "primaryGateActionRef" | "profileRef" | "editorRef" |
  "pageReadyBarrierRef" | "pageLoadTokenRef" | "applyingHostPageRef" | "generationRef" |
  "committedPageToken" | "isLoadingPage" | "mode" | "page" | "pageIDRef" | "revisionRef"
>) {

  const setCurrentPage = useCallback((nextPage: Page | null) => {
    pageRef.current = nextPage;
    setPage(nextPage);
  }, []);

  const focusEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target =
          modeRef.current === "blocks"
            ? (document.querySelector<HTMLElement>(
                '.bn-editor [contenteditable="true"]',
              ) ?? document.querySelector<HTMLElement>(".bn-editor"))
            : primaryGateActionRef.current;
        target?.focus({ preventScroll: true });
      });
    });
  }, []);

  const isPageReadinessCommitted = useCallback((target: PageReadyBarrier) => {
    const root = document.querySelector<HTMLElement>(".native-editor-root");
    const shellCommitted =
      root?.dataset.loading === "false" &&
      root.dataset.editorMode === modeRef.current &&
      root.dataset.pageLoadToken === String(target.token);
    const contentCommitted =
      modeRef.current === "blocks"
        ? Boolean(
            pageRef.current && profileRef.current && editorRef.current?.editor,
          )
        : Boolean(
            primaryGateActionRef.current &&
            document.body.contains(primaryGateActionRef.current),
          );
    return shellCommitted && contentCommitted;
  }, []);

  const beginPageReadiness = useCallback(
    (generation: number) => {
      const previous = pageReadyBarrierRef.current;
      if (previous && !previous.settled) {
        window.clearTimeout(previous.timeout);
        previous.settled = true;
        previous.reject(new Error("当前文件已切换，旧页面装载已取消。"));
      }
      let resolvePromise!: () => void;
      let rejectPromise!: (error: Error) => void;
      const promise = new Promise<void>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
      // A newer page can supersede this promise before receivePage reaches its
      // await. Keep the rejection observed while still letting active callers
      // receive the original failure.
      void promise.catch(() => undefined);
      pageLoadTokenRef.current += 1;
      const barrier: PageReadyBarrier = {
        token: pageLoadTokenRef.current,
        generation,
        settled: false,
        timeout: 0,
        promise,
        resolve: resolvePromise,
        reject: rejectPromise,
      };
      pageReadyBarrierRef.current = barrier;
      barrier.timeout = window.setTimeout(() => {
        if (pageReadyBarrierRef.current !== barrier || barrier.settled) return;
        applyingHostPageRef.current = false;
        barrier.settled = true;
        if (isPageReadinessCommitted(barrier)) barrier.resolve();
        else barrier.reject(new Error("编辑器未能完成当前文件的装载。"));
      }, 5_000);
      return barrier;
    },
    [isPageReadinessCommitted],
  );

  useLayoutEffect(() => {
    const barrier = pageReadyBarrierRef.current;
    if (
      !barrier ||
      barrier.token !== pageLoadTokenRef.current ||
      barrier.settled
    )
      return;
    if (barrier.generation !== generationRef.current) {
      window.clearTimeout(barrier.timeout);
      barrier.settled = true;
      barrier.reject(new Error("当前文件已切换，旧页面装载已取消。"));
      return;
    }
    if (!isPageReadinessCommitted(barrier)) return;
    window.clearTimeout(barrier.timeout);
    applyingHostPageRef.current = false;
    barrier.settled = true;
    barrier.resolve();
  }, [committedPageToken, isLoadingPage, isPageReadinessCommitted, mode, page]);

  const currentPageIdentity = useCallback((): PageIdentity | null => {
    const pageID = pageIDRef.current;
    if (!pageID) return null;
    return {
      token: pageLoadTokenRef.current,
      generation: generationRef.current,
      pageID,
    };
  }, []);

  const matchesPageIdentity = useCallback(
    (identity: PageIdentity) =>
      identity.token === pageLoadTokenRef.current &&
      identity.generation === generationRef.current &&
      identity.pageID === pageIDRef.current,
    [],
  );

  const matchesCurrentEnvelope = useCallback((envelope: BridgeEnvelope) => {
    if (!isValidEnvelope(envelope)) return false;
    if (!pageIDRef.current)
      return envelope.pageID === "" && envelope.revision === 0;
    return (
      envelope.pageID === pageIDRef.current &&
      envelope.revision === revisionRef.current
    );
  }, []);

  return { setCurrentPage, focusEditor, beginPageReadiness, currentPageIdentity, matchesPageIdentity, matchesCurrentEnvelope };
}
