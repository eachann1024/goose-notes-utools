import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import {
  trashedIdsFor,
  useSidebarCatalogVersion,
} from "@/stores/pages/sidebarCatalog";

interface TrashListProps {
  onBack?: () => void;
  showHeader?: boolean;
  itemHeight?: number;
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string | null) => void;
}

function nodeHasVisibleContent(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const value = node as {
    text?: unknown;
    content?: unknown;
    type?: unknown;
  };

  if (typeof value.text === "string" && value.text.trim().length > 0) {
    return true;
  }

  const children = Array.isArray(value.content) ? value.content : [];
  if (children.some((child: unknown) => nodeHasVisibleContent(child))) {
    return true;
  }

  if (
    value.type === "doc" ||
    value.type === "paragraph" ||
    value.type === "heading" ||
    value.type === "text" ||
    value.type === "hardBreak"
  ) {
    return false;
  }

  return typeof value.type === "string" && value.type.length > 0;
}

const trashBodyCache = new WeakMap<object, boolean>();

function pageHasVisibleContent(
  page: { content?: unknown } | null | undefined,
): boolean {
  const content = page?.content;
  if (!content || typeof content !== "object") return false;
  const cached = trashBodyCache.get(content);
  if (cached !== undefined) return cached;
  const visible = nodeHasVisibleContent(content);
  trashBodyCache.set(content, visible);
  return visible;
}

export function TrashList({
  onBack,
  showHeader = true,
  itemHeight = 52,
  selectedPageId,
  onSelectPage,
}: TrashListProps) {
  const activePageId = usePages((state) => state.activePageId);
  const setActivePage = usePages((state) => state.setActivePage);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);
  const catalogVersion = useSidebarCatalogVersion();
  const trashedIds = useMemo(() => {
    void catalogVersion;
    return trashedIdsFor(activeNotebookId, usePages.getState().pages);
  }, [activeNotebookId, catalogVersion]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: trashedIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 6,
  });
  const pageInTrash = (pageId: string | null | undefined) => {
    if (!pageId) return false;
    const page = usePages.getState().pages[pageId];
    if (!page?.trashedAt) return false;
    if (activeNotebookId && page.workspaceId !== activeNotebookId) return false;
    return true;
  };
  const selectedPageExists = pageInTrash(selectedPageId);
  const activePageExists = pageInTrash(activePageId);
  const highlightedPageId = selectedPageExists
    ? selectedPageId
    : activePageExists
      ? activePageId
      : null;

  // 回收站自己的选中态与 activePage 分开维护，保证本地文件夹/空编辑区场景也有高亮反馈。
  useEffect(() => {
    if (trashedIds.length === 0) {
      onSelectPage?.(null);
      return;
    }

    if (highlightedPageId) return;

    const nextPageId = trashedIds[0];
    onSelectPage?.(nextPageId);
    if (activePageId !== nextPageId) {
      closeNotebookAiIfFullscreen();
      setActivePage(nextPageId);
    }
  }, [
    activePageId,
    highlightedPageId,
    onSelectPage,
    setActivePage,
    trashedIds,
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      {showHeader && (
        <div className="flex items-center gap-2 px-3 py-3 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.08)]">
          <Button
            variant="ghost"
            size="icon"
            aria-label="返回"
            className="h-7 w-7"
            onClick={() => onBack?.()}
          >
            <LucideIcons.ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <LucideIcons.Trash2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">垃圾箱</span>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {trashedIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <LucideIcons.Trash2 className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">垃圾箱是空的</p>
          </div>
        ) : (
          <div
            className="relative px-2 pb-10 pt-0.5"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const page = usePages.getState().pages[trashedIds[virtualRow.index]];
              if (!page) return null;
              const iconName = page.icon;
              const DefaultPageIcon = pageHasVisibleContent(page)
                ? LucideIcons.FileText
                : LucideIcons.File;
              const timeAgo = page.trashedAt
                ? formatDistanceToNow(page.trashedAt, {
                    addSuffix: true,
                    locale: zhCN,
                  })
                : "";

              return (
                <button
                  type="button"
                  key={page.id}
                  style={{
                    height: virtualRow.size,
                    position: "absolute",
                    top: virtualRow.start,
                    left: 8,
                    right: 8,
                    width: "calc(100% - 16px)",
                  }}
                  aria-current={
                    highlightedPageId === page.id ? "page" : undefined
                  }
                  className={cn(
                    "group flex items-center gap-2 rounded-[8px] px-4 text-left transition-colors duration-200 overflow-hidden text-sm font-medium",
                    highlightedPageId === page.id
                      ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                      : "text-muted-foreground dark:text-muted-foreground/65 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
                  )}
                  onClick={() => {
                    closeNotebookAiIfFullscreen();
                    onSelectPage?.(page.id);
                    setActivePage(page.id);
                  }}
                >
                  {iconName ? (
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {(LucideIcons as any)[iconName] ? (
                        (() => {
                          const Icon = (LucideIcons as any)[iconName];
                          return <Icon className="h-4 w-4" />;
                        })()
                      ) : (
                        <span className="text-xs leading-none">{iconName}</span>
                      )}
                    </div>
                  ) : (
                    <DefaultPageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium leading-5">
                      {getPageTitle(page)}
                    </div>
                    <div className="text-xs leading-4 text-muted-foreground dark:text-muted-foreground/65">
                      {timeAgo}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {trashedIds.length > 0 && (
        <div className="p-3 text-sm text-muted-foreground text-center">
          30 天后自动永久删除
        </div>
      )}
    </div>
  );
}
