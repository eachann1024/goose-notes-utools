import { useCreateBlockNote } from "@blocknote/react";
import { GooseAIExtension } from "@/components/editor/ai/GooseAIExtension";
import { zh } from "@blocknote/core/locales";
import { type BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { normalizeExternalUrl } from "@/lib/openExternalUrl";
import { isPlatformPrimaryModifierEvent } from "@/lib/shortcut-platform";
import { gooseSelectAllExtension } from "@/components/editor/extensions/selectAllExtension";
import { gooseTableCellSelectionExtension } from "@/components/editor/extensions/tableCellSelectionExtension";
import { gooseCopyCurrentBlockExtension } from "@/components/editor/extensions/copyCurrentBlockExtension";
import { gooseMoveBlockExtension } from "@/components/editor/extensions/moveBlockExtension";
import {
  createGooseLinkKeyboardExtension,
  shouldArmLinkOpenHint,
} from "@/components/editor/extensions/linkKeyboardExtension";
import { gooseTabBehaviorExtension } from "@/components/editor/extensions/tabBehaviorExtension";
import { gooseBlockDragNestExtension } from "@/components/editor/extensions/blockDragNestExtension";
import { gooseCodeBlockKeyboardExtension } from "@/components/editor/extensions/codeBlockKeyboardExtension";
import { gooseCodeBlockLinkStripExtension } from "@/components/editor/extensions/codeBlockLinkStripExtension";
import { gooseFirstTitleEnterExtension } from "@/components/editor/extensions/firstTitleEnterExtension";
import { gooseMediaBlockEnterExtension } from "@/components/editor/extensions/mediaBlockEnterExtension";
import { gooseEmptyNestedListEnterExtension } from "@/components/editor/extensions/emptyNestedListEnterExtension";
import { gooseCollapsedToggleEnterExtension } from "@/components/editor/extensions/collapsedToggleEnterExtension";
import { gooseHeadingSectionFoldExtension } from "@/components/editor/extensions/headingSectionFoldExtension";
import { gooseCrossBlockDeleteExtension } from "@/components/editor/extensions/crossBlockDeleteExtension";
import { gooseEmptyBlockBackspaceExtension } from "@/components/editor/extensions/emptyBlockBackspaceExtension";
import { createGooseNumberedListStartNormalizationExtension } from "@/components/editor/extensions/numberedListStartNormalizationExtension";
import { createGooseBodyParagraphGuardExtension } from "@/components/editor/extensions/bodyParagraphGuardExtension";
import { createGooseFirstTitleGuardExtension } from "@/components/editor/inputrules/firstTitleGuard";
import { gooseMarkdownInputRulesExtension } from "@/components/editor/inputrules/markdownInputRules";
import { gooseDividerInputRuleExtension } from "@/components/editor/inputrules/dividerInputRule";
import { gooseSuppressMarkdownInSpecialBlocksExtension } from "@/components/editor/inputrules/suppressMarkdownInSpecialBlocks";
import { gooseHeadingMarkSuppressExtension } from "@/components/editor/extensions/headingMarkSuppressExtension";
import { gooseInlineCodeCaretExtension } from "@/components/editor/extensions/inlineCodeCaretExtension";
import { gooseCodeTextDropExtension } from "@/components/editor/extensions/codeTextDropExtension";
import { gooseLineBoundaryKeyboardExtension } from "@/components/editor/extensions/lineBoundaryKeyboardExtension";
import { gooseTrailingBlankClickExtension } from "@/components/editor/extensions/trailingBlankClickExtension";
import { createInlineCodePathTagExtension } from "@/components/editor/extensions/inlineCodePathTagExtension";
import { createPageMentionClickExtension } from "@/components/editor/extensions/pageMentionClickExtension";
import { gooseWikiLinkInputExtension } from "@/components/editor/extensions/wikiLinkInputExtension";
import { gooseInlineCodeBacktickWrapExtension } from "@/components/editor/extensions/inlineCodeBacktickWrapExtension";
import { gooseActiveListMarkerExtension } from "@/components/editor/extensions/activeListMarkerExtension";
import { gooseActiveHeadingCaretExtension } from "@/components/editor/extensions/activeHeadingCaretExtension";
import { gooseActiveLineExtension } from "@/components/editor/extensions/activeLineExtension";
import { gooseFakeSelectionExtension } from "@/components/editor/extensions/fakeSelectionExtension";
import { ArrowInputRuleExtension } from "@/components/editor/inputrules/arrowInputRule";
import { gooseFindInPageExtension } from "@/components/editor/find/findInPagePlugin";
import { createGooseSlashMenuReconcileExtension } from "@/components/editor/extensions/gooseSlashMenuReconcileExtension";
import { editorSchema } from "./EditorComposer";
import { isLinkworthyText } from "@/components/editor/utils/clipboard";
import { pasteClipboardFilesFromClipboard } from "@/components/editor/utils/pasteClipboardFilesFromClipboard";
import { clipboardHasPasteableImage, clipboardHasPasteableMedia } from "@/components/editor/utils/pasteClipboardImage";
import { uploadEditorFile } from "@/components/editor/utils/uploadEditorFile";
import { fileStorage } from "@/lib/fileStorage";
import { getFileUploadAvailability } from "@/lib/fileUploadAvailability";
import type { RefObject } from "react";
import type { EditorSettings, EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorPlatform } from "@/components/editor/platform/types";
import type { BlockNoteEditorOptions } from "@blocknote/core";

export function createEditorOptions({
  initialContentRef,
  usesRawEditorContentRef,
  pageMentionClickExtension,
  inlineCodePathTagExtension,
  settingsRef,
  editorInstanceRef,
  aiSettingsRef,
  inlineAiScopeRef,
  spellCheck,
  platformRef,
  getActivePageLocalFilePathRef,
  onOpenPageRef,
  openLinksInHostRef,
}: {
  initialContentRef: RefObject<BlockNoteContent>;
  usesRawEditorContentRef: RefObject<boolean>;
  pageMentionClickExtension: ReturnType<typeof createPageMentionClickExtension>;
  inlineCodePathTagExtension: ReturnType<typeof createInlineCodePathTagExtension>;
  settingsRef: RefObject<EditorSettings>;
  editorInstanceRef: RefObject<ReturnType<typeof useCreateBlockNote> | null>;
  aiSettingsRef: RefObject<EditorSettings["ai"]>;
  inlineAiScopeRef: RefObject<() => { pageId: string; editable: boolean; protectFirstTitle: boolean }>;
  spellCheck: boolean;
  platformRef: RefObject<EditorPlatform>;
  getActivePageLocalFilePathRef: RefObject<EditorPageContext["getActivePageLocalFilePath"]>;
  onOpenPageRef: RefObject<EditorPageContext["onOpenPage"]>;
  openLinksInHostRef: RefObject<boolean>;
}) {
  return {
    initialContent: initialContentRef.current as any,
    schema: editorSchema,
    // 原生 quote-block-shortcuts 仍禁用；引用由 markdownInputRules 认 >／＞／|／｜ + 半角空格。
    // 同时禁用 toggle-list-item-shortcuts：Enter 对非空 toggleListItem 无条件分裂，
    // 顺序先于自定义扩展；行为在 collapsedToggleEnterExtension 中按收起态重实现。
    disableExtensions: ["quote-block-shortcuts", "toggle-list-item-shortcuts", "divider-block-shortcuts"],
    extensions: [
      createGooseFirstTitleGuardExtension(usesRawEditorContentRef),
      createGooseBodyParagraphGuardExtension(usesRawEditorContentRef),
      gooseSuppressMarkdownInSpecialBlocksExtension,
      gooseHeadingMarkSuppressExtension,
      pageMentionClickExtension,
      gooseWikiLinkInputExtension,
      inlineCodePathTagExtension,
      gooseTrailingBlankClickExtension,
      gooseInlineCodeCaretExtension,
      gooseCodeTextDropExtension(),
      gooseLineBoundaryKeyboardExtension,
      gooseInlineCodeBacktickWrapExtension,
      gooseActiveListMarkerExtension,
      gooseActiveHeadingCaretExtension,
      gooseActiveLineExtension,
      gooseTabBehaviorExtension,
      gooseBlockDragNestExtension(),
      gooseSelectAllExtension,
      gooseTableCellSelectionExtension,
      gooseCopyCurrentBlockExtension,
      gooseMoveBlockExtension,
      createGooseLinkKeyboardExtension(settingsRef),
      gooseCodeBlockKeyboardExtension,
      gooseCodeBlockLinkStripExtension,
      gooseFirstTitleEnterExtension,
      gooseMediaBlockEnterExtension,
      gooseEmptyNestedListEnterExtension,
      gooseCollapsedToggleEnterExtension,
      gooseHeadingSectionFoldExtension,
      gooseCrossBlockDeleteExtension,
      gooseEmptyBlockBackspaceExtension,
      createGooseNumberedListStartNormalizationExtension(usesRawEditorContentRef),
      createGooseSlashMenuReconcileExtension(usesRawEditorContentRef, editorInstanceRef),
      gooseMarkdownInputRulesExtension(),
      gooseFakeSelectionExtension,
      ArrowInputRuleExtension,
      gooseFindInPageExtension,
      gooseDividerInputRuleExtension(),
      // 紧凑编辑器构建不挂 AI 扩展，避免加载不需要的模型依赖。
      ...(!__GOOSE_EDITOR_AI__
        ? []
        : [
            GooseAIExtension({
              getSettings: () => aiSettingsRef.current,
              getScope: () => inlineAiScopeRef.current(),
            }),
          ]),
    ],
    dictionary: {
      ...zh,
      placeholders: {
        ...zh.placeholders,
        // 速记小窗打开即可输入，不用长提示抢占空白草稿的视觉焦点。
        // 常规笔记本仍保留菜单入口提示。
        default: __GOOSE_LITE__ ? "" : "输入 / 、或随时 @ 提及笔记...",
        toggleListItem: "",
      },
    },
    domAttributes: {
      editor: {
        class: "goose-blocknote-editor",
        // 关闭浏览器/系统拼写检查：行内代码里的 hash、标识符、类名会被标红点
        // 下划线，看起来像链接。链接下划线走 CSS，不依赖 spellcheck。
        spellcheck: spellCheck ? "true" : "false",
      },
    },
    uploadFile: async (file, blockId) => {
      return uploadEditorFile(file, blockId, {
        getBlock: (id) => editorInstanceRef.current?.getBlock(id),
        imageStorage: platformRef.current.imageStorage,
        fileStorage,
        getFileUploadAvailability,
      });
    },
    pasteHandler: ({ event, editor: ed, defaultPasteHandler }) => {
      if (
        clipboardHasPasteableImage(event.clipboardData) ||
        (!__GOOSE_EDITOR_COMPACT__ && clipboardHasPasteableMedia(event.clipboardData))
      ) {
        void pasteClipboardFilesFromClipboard(event, ed);
        return true;
      }
      return defaultPasteHandler();
    },
    resolveFileUrl: async (url) => {
      return platformRef.current.imageStorage.resolveRefToUrl(url, getActivePageLocalFilePathRef.current());
    },
    links: {
      onClick: (event) => {
        const target = event.target as HTMLElement | null;
        const mention = target?.closest<HTMLElement>('[data-inline-content-type="pageMention"]');
        const mentionPageId = mention?.getAttribute("data-page-id") ?? mention?.dataset.pageId ?? "";
        const mentionWikiTarget = mention?.getAttribute("data-wiki-target") ?? mention?.dataset.wikiTarget ?? "";
        if (mention && (mentionPageId || mentionWikiTarget)) {
          const newTab = isPlatformPrimaryModifierEvent(event);
          const handled = onOpenPageRef.current(
            mentionPageId,
            mentionWikiTarget,
            newTab ? { newTab: true } : { splitOnly: true },
          );
          if (!newTab && handled === false) return false;
          return true;
        }
        if (!shouldArmLinkOpenHint(event)) {
          return false;
        }
        const link = target?.closest<HTMLAnchorElement>('a[data-inline-content-type="link"]');
        if (link) {
          const href = link.getAttribute("href");
          if (href) {
            const normalizedHref = normalizeExternalUrl(href);
            if (normalizedHref) {
              platformRef.current.shell.openUrl(normalizedHref, openLinksInHostRef.current);
            }
          }
        }
        return true;
      },
      // autolink/粘贴/HTML 导入的统一闸口：linkifyjs 认全量 TLD 表，
      // `AppClient.java`(.java 是真实 gTLD)这类类名/文件名会被误转链接，
      // 这里收紧为「协议白名单 + 裸域名常用 TLD 白名单」，见 isLinkworthyText。
      isValidLink: isLinkworthyText,
    },
  } satisfies Partial<BlockNoteEditorOptions<any, any, any>>;
}
