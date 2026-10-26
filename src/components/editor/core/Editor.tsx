import { useCallback, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/react/style.css";
import { useEditorSettings, useEditorPageContext } from "@/components/editor/platform/hostContext";
import { useEditorPlatform } from "@/components/editor/platform/context";
import {
  createEditorSafeContent,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { EditorComposer, editorSchema } from "./EditorComposer";
import { useEditorShortcuts } from "@/components/editor/hooks/useEditorShortcuts";
import { useEditorPaste } from "@/components/editor/hooks/useEditorPaste";
import { useEditorInteraction } from "./useEditorInteraction";
import { useEditorExtensions } from "./useEditorExtensions";
import { useEditorEditability } from "./useEditorEditability";
import { useEditorContentSnapshot } from "./useEditorContentSnapshot";
import { useEditorPageLifecycle } from "./useEditorPageLifecycle";
import { useEditorSlashMenu } from "./useEditorSlashMenu";
import { useEditorFocus } from "./useEditorFocus";
import { useSlashMenuWarmup } from "./useEditorSlashMenu";
import { useEditorClipboard } from "./useEditorClipboard";
import { useEditorComposition } from "./useEditorComposition";
import { useEditorContentCommit } from "./useEditorContentCommit";
import { useEditorHostEvents } from "./useEditorHostEvents";
import { useEditorSelection } from "./useEditorSelection";
import { useEditorTheme } from "./useEditorTheme";
import type { EditorRef, EditorProps } from "./editorTypes";
export type { EditorRef } from "./editorTypes";
import { createEditorOptions } from "./createEditorOptions";
import { toEditorBlocks, getCachedContentSignature } from "./editorContentPolicy";

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor(
  { editable = true, isActiveEditor = true, spellCheck = false, hiddenSlashItemTitles, showSideMenu = true },
  ref,
) {
  const settings = useEditorSettings();
  const { theme, searchProviders, customActions, ai: aiSettings, openLinksInHost } = settings;
  const {
    page,
    contentMode,
    isEditorFullWidth,
    onContentChange,
    onOpenPage,
    getActivePageLocalFilePath,
    getActivePageLocalFolderRoot,
    onOpenAttachment,
    getLatestPage,
  } = useEditorPageContext();
  const platform = useEditorPlatform();
  const activePageId = page?.id ?? null;

  const pageIdForUpdateRef = useRef<string | null>(activePageId);
  const syncedContentSignatureRef = useRef<string | null>(null);
  // 只有 BlockNote 真正触发了待提交的 onChange 才需要在切页时克隆整篇文档。
  // 只读浏览后切到文件夹主页时直接跳过，避免大文件产生同步长任务。
  const pendingEditorChangeRef = useRef(false);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const shiftPressedRef = useRef(false);

  // 点击编辑器空白区域消闪：mousedown 时短暂抑制格式化工具栏（prosemirror 会先短暂
  // 出现非空选区再被 focusEditorEnd 塌缩），mouseup 时恢复。
  const [suppressFormattingToolbar, setSuppressFormattingToolbar] = useState(false);
  const suppressFormattingToolbarRef = useRef(false);

  // 注入回调/数据的最新引用：供 useCreateBlockNote（deps=[]）的闭包与各 effect 读取，
  // 避免把 settings/pageContext 直接进依赖数组导致编辑器重建（行为不变）。
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const onContentChangeRef = useRef(onContentChange);
  const onOpenPageRef = useRef(onOpenPage);
  onOpenPageRef.current = onOpenPage;
  const getActivePageLocalFilePathRef = useRef(getActivePageLocalFilePath);
  getActivePageLocalFilePathRef.current = getActivePageLocalFilePath;
  const getActivePageLocalFolderRootRef = useRef(getActivePageLocalFolderRoot);
  getActivePageLocalFolderRootRef.current = getActivePageLocalFolderRoot;
  const onOpenAttachmentRef = useRef(onOpenAttachment);
  onOpenAttachmentRef.current = onOpenAttachment;
  const pageRef = useRef(page);
  pageRef.current = page;
  const contentModeRef = useRef(contentMode);
  const inlineAiScopeRef = useRef(() => ({ pageId: "", editable: false, protectFirstTitle: true }));
  inlineAiScopeRef.current = () => {
    const latest = getLatestPage ? getLatestPage(page.id) : page;
    return {
      pageId: page.id,
      editable: Boolean(
        latest &&
        editable &&
        !latest.isLocked &&
        !latest.trashedAt &&
        !(latest.localFilePath && latest.localReadState === "error"),
      ),
      protectFirstTitle: contentMode === "normalized",
    };
  };
  // platformRef 供 useCreateBlockNote 闭包（deps=[]）调用平台能力，
  // 同 aiSettingsRef 模式，避免闭包捕获旧 platform 引用。
  const platformRef = useRef(platform);
  platformRef.current = platform;
  const openLinksInHostRef = useRef(openLinksInHost);
  openLinksInHostRef.current = openLinksInHost;
  // settingsRef 供 useCreateBlockNote 闭包（deps=[]）调用平台设置，避免闭包捕获旧配置
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** uploadFile 与同 tick 粘贴需 getBlock；每 render 同步 */
  const editorInstanceRef = useRef<ReturnType<typeof useCreateBlockNote> | null>(null);

  // raw 文档保持宿主传入的块结构，不施加页面级标题和空正文规范；
  // normalized 文档沿用完整页面规范化规则。
  const usesRawEditorContent = contentMode === "raw";
  const usesRawEditorContentRef = useRef(usesRawEditorContent);
  usesRawEditorContentRef.current = usesRawEditorContent;
  const normalizeContent = (c: unknown): BlockNoteContent =>
    usesRawEditorContent ? toEditorBlocks(c) : normalizePageContent(c as Parameters<typeof normalizePageContent>[0]);

  // 用户意图门控（仅 raw 文档消费）：BlockNote 对部分块（折叠块/视频/带
  // 属性图片等）会在初始化后异步补全 props，触发与基线签名不一致的 onChange——
  // 这不是用户编辑，不应入保存队列。这里记录「自上次程序化同步以来用户是否真实
  // 交互过」：pointerdown/keydown/paste/cut/drop 任一发生即视为有交互（覆盖打字、
  // IME、点勾选框/工具栏/菜单、拖拽块、表格操作等全部真实编辑入口；误报无害——
  // 内容未变签名相等不会入队，变了还有写盘前 diff 兜底）。切页/外部重载后重置。
  const userInteractedRef = useRef(false);
  useEditorInteraction({
    userInteractedRef,
    editorInstanceRef,
  });

  // 程序化同步路径（非 silent 入队以外的 store 同步）：供 onChange 在「无用户交互」
  // 时把编辑器自动补全后的内容静默同步进 store（不标脏、不入保存队列、不刷 updatedAt）。
  const silentContentSync = useCallback((content: BlockNoteContent) => {
    onContentChangeRef.current(content, { silent: true });
  }, []);
  const { inlineCodePathTagExtension, pageMentionClickExtension } = useEditorExtensions({
    getActivePageLocalFilePathRef,
    getActivePageLocalFolderRootRef,
    platformRef,
    onOpenAttachmentRef,
    onOpenPageRef,
  });

  const initialContentRef = useRef(createEditorSafeContent(normalizeContent(page?.content), editorSchema));
  // 初次 mount 时给 syncedContentSignatureRef 设置基线，
  // 否则切走时 flush 会把"只读打开"误判成编辑、刷新 updatedAt。
  if (syncedContentSignatureRef.current === null) {
    syncedContentSignatureRef.current = getCachedContentSignature(initialContentRef.current);
  }
  const editor = useCreateBlockNote(
    createEditorOptions({
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
    }),
    [],
  );
  editorInstanceRef.current = editor;
  const { readCurrentEditorContent, debouncedUpdate } = useEditorContentSnapshot({
    editor,
    contentModeRef,
    pageIdForUpdateRef,
    pendingEditorChangeRef,
    syncedContentSignatureRef,
    onContentChangeRef,
  });

  const { commitEditorContent } = useEditorContentCommit({
    pageIdForUpdateRef,
    debouncedUpdate,
    readCurrentEditorContent,
    pendingEditorChangeRef,
    syncedContentSignatureRef,
    onContentChangeRef,
  });
  const prevPageIdRef = useRef<string | null>(activePageId);
  useEditorPageLifecycle({
    activePageId,
    onContentChange,
    contentMode,
    commitEditorContent,
    prevPageIdRef,
    userInteractedRef,
    pendingEditorChangeRef,
    debouncedUpdate,
    pageRef,
    pageIdForUpdateRef,
    contentModeRef,
    editor,
    syncedContentSignatureRef,
    onContentChangeRef,
  });
  useEditorEditability({
    editor,
    activePageId,
    editable,
    page,
  });
  const { getSlashItems } = useEditorSlashMenu({
    editor,
    aiSettingsRef,
    contentModeRef,
    settingsRef,
    hiddenSlashItemTitles,
  });

  const { handleEditorPasteCapture } = useEditorPaste({
    editor,
    editable,
    shiftPressedRef,
  });
  const { focusEditorSafely, handleEditorBlankMouseDown } = useEditorFocus({
    editor,
    usesRawEditorContentRef,
    editable,
    editorContainerRef,
    suppressFormattingToolbarRef,
    setSuppressFormattingToolbar,
  });

  useEditorShortcuts({ shiftPressedRef });
  useSlashMenuWarmup();
  useEditorClipboard({
    editorContainerRef,
    editor,
    platformRef,
    getActivePageLocalFilePathRef,
  });
  useEditorComposition({
    editorContainerRef,
    editor,
    usesRawEditorContentRef,
  });
  useEditorHostEvents({
    commitEditorContent,
    isActiveEditor,
    pageRef,
    usesRawEditorContentRef,
    editor,
    focusEditorSafely,
    pageIdForUpdateRef,
    getLatestPage,
    contentModeRef,
    syncedContentSignatureRef,
    editorContainerRef,
    debouncedUpdate,
    pendingEditorChangeRef,
    userInteractedRef,
  });

  useImperativeHandle(
    ref,
    () => ({
      editor,
    }),
    [editor],
  );
  useEditorSelection({
    isActiveEditor,
    editor,
    onOpenPageRef,
  });

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");
  useEditorTheme({
    theme,
    setEffectiveTheme,
  });

  if (!page) return null;

  return (
    <EditorComposer
      editor={editor}
      editable={editable}
      page={page}
      editorContainerRef={editorContainerRef}
      handleEditorBlankMouseDown={handleEditorBlankMouseDown}
      handleEditorPasteCapture={handleEditorPasteCapture}
      getSlashItems={getSlashItems}
      pageIdForUpdateRef={pageIdForUpdateRef}
      syncedContentSignatureRef={syncedContentSignatureRef}
      pendingEditorChangeRef={pendingEditorChangeRef}
      debouncedUpdate={debouncedUpdate}
      userInteractedRef={userInteractedRef}
      silentContentSync={silentContentSync}
      isEditorFullWidth={isEditorFullWidth}
      effectiveTheme={effectiveTheme}
      searchProviders={searchProviders}
      customActions={customActions}
      showSideMenu={showSideMenu}
      suppressFormattingToolbar={suppressFormattingToolbar}
      usesRawEditorContent={usesRawEditorContent}
    />
  );
});
