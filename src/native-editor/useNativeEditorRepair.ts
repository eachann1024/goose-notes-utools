import { createRequestID, postToHost } from "./bridge";
import { createNativePage } from "./nativeEditorDefinitions";
import { type NativeEditorBindings } from "./nativeEditorBindings";

export function useNativeEditorRepair({
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
}: Pick<NativeEditorBindings,
  "pageIDRef" | "revisionRef" | "repairCandidateRef" | "modeRef" | "generationRef" |
  "beginPageReadiness" | "applyingHostPageRef" | "profileRef" | "frontmatterRef" |
  "acceptedRepairMarkdownRef" | "setRepairDeclined" | "setMode" | "setCommittedPageToken" |
  "setEditorGeneration" | "setCurrentPage" | "font" | "fontSize" | "fullWidth" | "pageLoadTokenRef" |
  "markDirty" | "focusEditor" | "pageReadyBarrierRef" | "primaryGateActionRef"
>) {

  const reload = () => {
    if (!pageIDRef.current) return;
    postToHost({
      version: 1,
      type: "reloadRequest",
      requestID: createRequestID(),
      pageID: pageIDRef.current,
      revision: revisionRef.current,
    });
  };

  const acceptRepair = () => {
    const candidate = repairCandidateRef.current;
    if (
      !candidate ||
      modeRef.current !== "repair-required" ||
      candidate.generation !== generationRef.current ||
      candidate.input.pageID !== pageIDRef.current
    )
      return;
    const readiness = beginPageReadiness(candidate.generation);
    applyingHostPageRef.current = true;
    modeRef.current = "blocks";
    profileRef.current = candidate.profile;
    frontmatterRef.current = candidate.frontmatter;
    acceptedRepairMarkdownRef.current = candidate.normalizedMarkdown;
    setRepairDeclined(false);
    setMode("blocks");
    setCommittedPageToken(readiness.token);
    setEditorGeneration(readiness.token);
    setCurrentPage(
      createNativePage(
        {
          ...candidate.input,
          editorFont: font,
          editorFontSize: fontSize,
          fullWidth,
        },
        candidate.blocks,
        font,
      ),
    );
    void readiness.promise
      .then(() => {
        if (
          readiness.token !== pageLoadTokenRef.current ||
          candidate.generation !== generationRef.current
        )
          return;
        markDirty();
        focusEditor();
      })
      .catch(() => {
        if (
          readiness.token !== pageLoadTokenRef.current ||
          candidate.generation !== generationRef.current
        )
          return;
        if (pageReadyBarrierRef.current === readiness) {
          pageReadyBarrierRef.current = null;
        }
        applyingHostPageRef.current = false;
        modeRef.current = "repair-required";
        profileRef.current = null;
        frontmatterRef.current = null;
        acceptedRepairMarkdownRef.current = "";
        setMode("repair-required");
        setCurrentPage(null);
      });
  };

  const keepOriginal = () => {
    setRepairDeclined(true);
    window.requestAnimationFrame(() => primaryGateActionRef.current?.focus());
  };

  return { reload, acceptRepair, keepOriginal };
}
