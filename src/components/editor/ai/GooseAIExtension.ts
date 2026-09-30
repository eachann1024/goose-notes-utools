import {
  createExtension,
  createStore,
  type ExtensionOptions,
} from "@blocknote/core";
import type { AISettingsLike } from "@/lib/ai-provider/types";
import {
  applyPrivateInlineDraft,
  assertPrivateInlineTarget,
  capturePrivateInlineTarget,
  preparePrivateInlineDraft,
  type PrivateInlineTarget,
} from "@/lib/notebook-ai/inlineMarkdownApplySelection";
import {
  createInlineRewriteSession,
  type InlineMenuState,
} from "./inlineRewriteSession";
import { composeInlineBusyTicker } from "./inlineBusyTicker";
import { runInlineMarkdownRewrite } from "./transport/runInlineMarkdownRewrite";

type Options = {
  getScope: () => {
    pageId: string;
    editable: boolean;
    protectFirstTitle: boolean;
  };
  getSettings: () => AISettingsLike & {
    enabled?: boolean;
    workspaceSelectedModelId?: string | null;
    customModelOptions?: Array<{ id: string }>;
  };
};

export const GooseAIExtension = createExtension(
  ({ editor, options }: ExtensionOptions<Options>) => {
    const store = createStore<{ aiMenuState: InlineMenuState }>({
      aiMenuState: "closed",
    });
    const session = createInlineRewriteSession<
      PrivateInlineTarget & { pageId: string },
      ReturnType<typeof preparePrivateInlineDraft>
    >({
      getState: () => store.state.aiMenuState,
      setState: (aiMenuState) => store.setState(() => ({ aiMenuState })),
      capture(blockId) {
        const scope = options.getScope();
        const target = capturePrivateInlineTarget(editor, blockId);
        if (
          scope.protectFirstTitle &&
          target.sourceBlockIds.includes(editor.document[0]?.id)
        ) {
          throw new Error("页面标题不支持行内 AI 改写，请选择正文。");
        }
        return { ...target, pageId: scope.pageId };
      },
      validate(target) {
        const scope = options.getScope();
        if (
          !scope.editable ||
          scope.pageId !== target.pageId ||
          options.getSettings().enabled === false
        ) {
          throw new Error("页面已切换或不可编辑，请重新选择正文。");
        }
        assertPrivateInlineTarget(editor, target);
      },
      rewrite(target, userPrompt, abortSignal, update) {
        const settings = options.getSettings();
        const models = settings.customModelOptions ?? [];
        const preferred = settings.workspaceSelectedModelId?.trim();
        const modelId =
          (preferred && models.some((model) => model.id === preferred)
            ? preferred
            : "") ||
          settings.selectedModelId?.trim() ||
          models[0]?.id ||
          "";
        if (!modelId) throw new Error("请先选择模型后再使用行内 AI。");
        return runInlineMarkdownRewrite({
          settings,
          modelId,
          userPrompt,
          oldMarkdown: target.oldMarkdown,
          abortSignal,
          onUpdate: (updateValue) =>
            update(composeInlineBusyTicker(updateValue)),
        });
      },
      prepare: (target, markdown) =>
        preparePrivateInlineDraft(editor, target, markdown),
      apply: (target, draft) => applyPrivateInlineDraft(editor, target, draft),
    });
    return {
      key: "goose-inline-ai" as const,
      store,
      ...session,
      mount() {
        const unsubscribe = editor.onChange(() => session.invalidateIfNeeded());
        return () => {
          unsubscribe();
          session.closeAIMenu();
        };
      },
    };
  },
);
