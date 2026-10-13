export type {
  AiSelectionQuoteAttrs,
  AiFileReferenceSourceType,
  AiReferenceRole,
  AiFileReferenceAttrs,
  AiReferenceSuggestionItem,
  AiImageAttachmentAttrs,
  AiSkillCommandAttrs,
  AiComposerToken,
  AiComposerPayload,
  AiReferenceOccurrence,
  NormalizedAiComposerPayload,
  ResolvedAiReferenceContext,
} from "./reference-lookup/types";
export { inferAiReferenceRole, normalizeAiComposerPayload } from "./reference-lookup/roles";
export { buildAiFileReferenceAttrs, getAiReferenceSuggestionItems } from "./reference-lookup/suggestions";
export { serializeAiComposerDoc } from "./reference-lookup/serialization";
export { buildFolderReferenceContext, resolveAiReferenceContexts, formatAiReferenceContextBlock, getAiReferenceStats } from "./reference-lookup/contexts";
