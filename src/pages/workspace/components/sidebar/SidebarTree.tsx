import {
  closestCenter,
  pointerWithin,
  PointerSensor,
  type Collision,
  type CollisionDetection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  favoriteTitleCount,
  sidebarPageTitle,
  useSidebarCatalogVersion,
} from "@/stores/pages/sidebarCatalog";
import type { Page } from "@/types";
import { LocalFolderLoadingSkeleton } from "./LocalFolderLoadingSkeleton";
import { buildSidebarTitleDisambiguationMap } from "./sidebar-title-disambiguation";
import { buildVisibleTree, type FlatTreeItem } from "./tree-dnd";
import {
  useTreeDragHandlers,
  type DropIntent,
  type SidebarDragGuide,
} from "./tree/useTreeDragHandlers";
import { TreeViewport } from "./tree/TreeViewport";
import { TreeEmptyState } from "./tree/TreeEmptyState";

interface SidebarTreeProps {
  activeNotebookId: string | null;
  selectedPageId?: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
  onDragGuideChange?: (guide: SidebarDragGuide | null) => void;
  rootPageIds?: readonly string[];
  fitContent?: boolean;
  showEmptyState?: boolean;
  allowNest?: boolean;
  resolveSiblings?: (parentId: string | undefined) => Page[];
  onReorder?: (ids: string[], parentId: string | undefined) => void;
  showAddChildButton?: boolean;
  draggablePageIds?: readonly string[];
  flatRoots?: boolean;
}

class LeftButtonPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) =>
        nativeEvent.isPrimary &&
        nativeEvent.button === 0 &&
        !nativeEvent.ctrlKey,
    },
  ];
}

const FAVORITE_TRACK_ROWS = 4000;
const FAVORITE_VIEW_CAP = 24;

function favoriteTrackHeight(count: number, rowHeight: number) {
  return Math.min(Math.max(count, 0), FAVORITE_TRACK_ROWS) * Math.max(1, rowHeight);
}

function favoriteWindow(
  count: number,
  rowHeight: number,
  viewport: number,
  scrollTop: number,
): { rows: VirtualItem[]; height: number } {
  const safeRow = Math.max(1, rowHeight);
  const visible = Math.min(
    FAVORITE_VIEW_CAP,
    Math.ceil(Math.min(Math.max(viewport, 1), 320) / safeRow) + 6,
  );
  const height = favoriteTrackHeight(count, safeRow);
  const maxScroll = Math.max(1, height - viewport);
  const progress =
    height <= viewport ? 0 : Math.min(1, Math.max(0, scrollTop) / maxScroll);
  const maxStart = Math.max(0, count - visible);
  const from = Math.min(maxStart, Math.floor(progress * maxStart));
  const rows: VirtualItem[] = [];
  for (let index = from; index < Math.min(count, from + visible); index += 1) {
    const local = index - from;
    const start = scrollTop + local * safeRow;
    rows.push({
      index,
      key: index,
      start,
      size: safeRow,
      end: start + safeRow,
      lane: 0,
    });
  }
  return { rows, height };
}

export function SidebarTree({
  activeNotebookId,
  selectedPageId,
  width,
  rowHeight,
  itemHeight,
  viewportHeight,
  onCreatePage,
  onDragGuideChange,
  rootPageIds,
  fitContent = false,
  showEmptyState = true,
  allowNest = true,
  resolveSiblings,
  onReorder,
  showAddChildButton = true,
  draggablePageIds,
  flatRoots = false,
}: SidebarTreeProps) {
  const catalogVersion = useSidebarCatalogVersion();
  const pages = usePages.getState().pages;
  const activePageId = usePages((s) => s.activePageId);
  const reorderPages = usePages((s) => s.reorderPages);
  const getChildren = usePages((s) => s.getChildren);
  const expandPageId = usePages((s) => s.expandPageId);
  const setExpandPageId = usePages((s) => s.setExpandPageId);
  // selectedPageId 传 null 表示"不高亮任何项"（如 AI 界面打开时），undefined 才 fallback 到 activePageId
  const highlightedPageId =
    selectedPageId !== undefined ? selectedPageId : activePageId;

  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalNotebook = notebook?.source === "local-folder";
  const localLoadStatus = useNotebooks((state) =>
    activeNotebookId
      ? (state.localFolderLoadStates[activeNotebookId]?.status ?? "idle")
      : "idle",
  );
  const shouldShowLocalSkeleton =
    !rootPageIds && isLocalNotebook && localLoadStatus === "loading";

  const [openPageIds, setOpenPageIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
  const [titleRevealResetSignal, setTitleRevealResetSignal] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragGuideKeyRef = useRef<string>("__init__");

  const largeFlat = Boolean(flatRoots && rootPageIds && rootPageIds.length > 48);

  const visibleItems = useMemo(() => {
    const livePages = usePages.getState().pages;
    if (flatRoots && rootPageIds && rootPageIds.length > 0) {
      if (largeFlat) return [];
      const items: FlatTreeItem[] = [];
      for (const id of rootPageIds) {
        const page = livePages[id];
        if (!page || page.trashedAt) continue;
        if (activeNotebookId && page.workspaceId !== activeNotebookId) continue;
        items.push({
          id: page.id,
          page,
          depth: 0,
          parentId: undefined,
          hasChildren: false,
          isOpen: false,
        });
      }
      return items;
    }
    return buildVisibleTree({
      pages: livePages,
      openIds: openPageIds,
      workspaceId: activeNotebookId || undefined,
      isLocalNotebook,
      rootPageIds,
      flatRoots,
    });
  }, [
    catalogVersion,
    openPageIds,
    activeNotebookId,
    isLocalNotebook,
    rootPageIds,
    flatRoots,
    largeFlat,
  ]);

  const activeDescendantIds = useMemo(() => {
    // flatRoots 模式（收藏区平铺列表）下所有 item 视为虚拟根的直接子项，
    // 不存在祖先-后代关系，强制返回空集，避免误拦截平铺重排。
    if (!activeId || flatRoots) return new Set<string>();
    const descendants = new Set<string>();
    const stack = [activeId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      Object.values(pages).forEach((page) => {
        if (page.trashedAt || page.parentId !== currentId) return;
        descendants.add(page.id);
        stack.push(page.id);
      });
    }

    return descendants;
  }, [activeId, pages, flatRoots]);

  const renderItems = useMemo(
    () =>
      activeId
        ? visibleItems.filter((item) =>
            "isPlaceholder" in item ? true : !activeDescendantIds.has(item.id),
          )
        : visibleItems,
    [visibleItems, activeId, activeDescendantIds],
  );
  const titleDisambiguationMap = useMemo(() => {
    const livePages = usePages.getState().pages;
    if (flatRoots && rootPageIds && rootPageIds.length > 0 && !largeFlat) {
      return disambiguateFlatTitles(rootPageIds, livePages);
    }
    if (largeFlat) return new Map<string, string>();
    return buildSidebarTitleDisambiguationMap({
      pages: livePages,
      activeNotebookId,
      notebook,
      rootPageIds,
    });
  }, [catalogVersion, activeNotebookId, notebook, rootPageIds, flatRoots, largeFlat]);

  const flatItems = useMemo(
    () =>
      renderItems.filter(
        (item) => !("isPlaceholder" in item),
      ) as FlatTreeItem[],
    [renderItems],
  );
  const draggablePageIdSet = useMemo(
    () => (draggablePageIds ? new Set(draggablePageIds) : null),
    [draggablePageIds],
  );

  const visibleIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    renderItems.forEach((item, index) => {
      if ("isPlaceholder" in item) return;
      map.set(item.id, index);
    });
    return map;
  }, [renderItems]);
  const resetTitleReveal = useCallback(() => {
    setTitleRevealResetSignal((current) => current + 1);
  }, []);

  const DragSensor = LeftButtonPointerSensor;
  const sensors = useSensors(
    useSensor(DragSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const filterSelf = (collisions: Collision[]) =>
      collisions.filter(
        (collision) => String(collision.id) !== String(args.active.id),
      );
    const pointerHits = filterSelf(pointerWithin(args));
    if (pointerHits.length > 0) {
      return pointerHits;
    }
    return filterSelf(closestCenter(args));
  }, []);

  const virtualizer = useVirtualizer({
    count: largeFlat ? 0 : renderItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    initialRect: { width: 240, height: 320 },
  });
  const [flatScrollTop, setFlatScrollTop] = useState(0);
  const [flatViewport, setFlatViewport] = useState(320);
  const flatWindow =
    largeFlat && rootPageIds
      ? favoriteWindow(rootPageIds.length, rowHeight, flatViewport, flatScrollTop)
      : null;

  useLayoutEffect(() => {
    if (!largeFlat) return;
    const element = scrollRef.current;
    if (!element) return;
    const publish = () => {
      if (element.hidden || element.clientHeight === 0) return;
      const nextHeight = element.clientHeight;
      const nextTop = element.scrollTop;
      setFlatViewport((prev) => (prev === nextHeight ? prev : nextHeight));
      setFlatScrollTop((prev) => (prev === nextTop ? prev : nextTop));
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    element.addEventListener("scroll", publish, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", publish);
    };
  }, [largeFlat, scrollRef]);

  const handleToggle = useCallback((id: string) => {
    setOpenPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getSiblingPages = useCallback(
    (parentId: string | undefined) => {
      if (resolveSiblings) {
        return resolveSiblings(parentId);
      }
      return getChildren(parentId, activeNotebookId || undefined);
    },
    [resolveSiblings, getChildren, activeNotebookId],
  );

  useEffect(() => {
    if (!expandPageId) return;

    const page = pages[expandPageId];
    if (!page) return;
    if (page.trashedAt) {
      setExpandPageId(null);
      return;
    }
    if (activeNotebookId && page.workspaceId !== activeNotebookId) {
      return;
    }

    const ancestorIds: string[] = [];
    let current = page;
    while (current.parentId && pages[current.parentId]) {
      ancestorIds.push(current.parentId);
      current = pages[current.parentId];
    }

    setOpenPageIds((prev) => {
      const next = new Set(prev);
      ancestorIds.forEach((id) => next.add(id));
      return next;
    });

    const timer = window.setTimeout(() => {
      const index =
        largeFlat && rootPageIds
          ? rootPageIds.indexOf(expandPageId)
          : renderItems.findIndex((item) => item.id === expandPageId);
      if (index < 0) return;
      if (largeFlat && rootPageIds && scrollRef.current) {
        const element = scrollRef.current;
        const viewport = element.clientHeight || 320;
        const height = favoriteTrackHeight(rootPageIds.length, rowHeight);
        const visible = Math.min(
          FAVORITE_VIEW_CAP,
          Math.ceil(Math.min(viewport, 320) / Math.max(1, rowHeight)) + 6,
        );
        const maxStart = Math.max(0, rootPageIds.length - visible);
        const start = Math.min(maxStart, Math.max(0, index - 4));
        const maxScroll = Math.max(0, height - viewport);
        element.scrollTop = maxStart === 0 ? 0 : (start / maxStart) * maxScroll;
        return;
      }
      virtualizer.scrollToIndex(index, { align: "center" });
    }, 80);

    setExpandPageId(null);
    return () => window.clearTimeout(timer);
  }, [
    expandPageId,
    pages,
    activeNotebookId,
    setExpandPageId,
    renderItems,
    rootPageIds,
    largeFlat,
    rowHeight,
    virtualizer,
  ]);

  const emitDragGuide = useCallback(
    (guide: SidebarDragGuide | null) => {
      if (!onDragGuideChange) return;
      const key = guide ? `${guide.direction}:${guide.mode}` : "__none__";
      if (dragGuideKeyRef.current === key) return;
      dragGuideKeyRef.current = key;
      onDragGuideChange(guide);
    },
    [onDragGuideChange],
  );

  useEffect(() => {
    return () => {
      onDragGuideChange?.(null);
    };
  }, [onDragGuideChange]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      resetTitleReveal();
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [resetTitleReveal]);

  const resolveFlatItem = useCallback((id: string): FlatTreeItem | undefined => {
    const page = usePages.getState().pages[id];
    if (!page) return undefined;
    return {
      id,
      page,
      depth: 0,
      parentId: undefined,
      hasChildren: false,
      isOpen: false,
    };
  }, [catalogVersion]);
  const edgeIds =
    largeFlat && rootPageIds && rootPageIds.length > 0
      ? {
          first: rootPageIds[0],
          last: rootPageIds[rootPageIds.length - 1],
        }
      : undefined;
  const dragIndexMap = (() => {
    if (!largeFlat || !rootPageIds || !flatWindow) return visibleIndexMap;
    const map = new Map<string, number>();
    for (const row of flatWindow.rows) {
      const id = rootPageIds[row.index];
      if (id) map.set(id, row.index);
    }
    return map;
  })();

  const {
    handleDragCancel,
    handleDragEnd,
    handleDragMove,
    handleDragOver,
    handleDragStart,
  } = useTreeDragHandlers({
    activeDescendantIds,
    allowNest,
    dropIntent,
    emitDragGuide,
    flatItems,
    edgeIds,
    resolveFlatItem: largeFlat ? resolveFlatItem : undefined,
    getSiblingPages,
    isLocalNotebook,
    itemHeight,
    onReorder,
    pages,
    reorderPages,
    resetTitleReveal,
    rowHeight,
    scrollRef,
    setActiveId,
    setDropIntent,
    setOpenPageIds,
    visibleIndexMap: dragIndexMap,
  });

  if (shouldShowLocalSkeleton) {
    return <LocalFolderLoadingSkeleton />;
  }

  if (!largeFlat && flatItems.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <TreeEmptyState
          isLocalNotebook={isLocalNotebook}
          height={viewportHeight}
        />
      </div>
    );
  }

  const contentHeight = fitContent
    ? Math.max(renderItems.length * rowHeight, rowHeight)
    : flatWindow
      ? flatWindow.height
      : Math.max(virtualizer.getTotalSize(), viewportHeight || 0);
  const virtualItems = flatWindow ? flatWindow.rows : virtualizer.getVirtualItems();

  return (
    <TreeViewport
      activeId={activeId}
      collisionDetection={collisionDetection}
      contentHeight={contentHeight}
      draggablePageIdSet={draggablePageIdSet}
      dropIntent={dropIntent}
      fitContent={fitContent}
      handleDragCancel={handleDragCancel}
      handleDragEnd={handleDragEnd}
      handleDragMove={handleDragMove}
      handleDragOver={handleDragOver}
      handleDragStart={handleDragStart}
      highlightedPageId={highlightedPageId}
      isLocalNotebook={isLocalNotebook}
      itemHeight={itemHeight}
      renderItems={renderItems}
      rowHeight={rowHeight}
      scrollRef={scrollRef}
      sensors={sensors}
      showAddChildButton={showAddChildButton}
      titleDisambiguationMap={
        largeFlat && rootPageIds
          ? disambiguateVisibleFavorites(
              virtualItems.map((row) => rootPageIds[row.index]).filter((id): id is string => !!id),
            )
          : titleDisambiguationMap
      }
      showExpandControls={!flatRoots}
      titleRevealResetSignal={titleRevealResetSignal}
      virtualItems={virtualItems}
      resolveItem={
        largeFlat && rootPageIds
          ? (index) => resolveFlatItem(rootPageIds[index] ?? "")
          : undefined
      }
      sortableIds={
        largeFlat && rootPageIds
          ? virtualItems
              .map((row) => rootPageIds[row.index])
              .filter((id): id is string => !!id)
          : undefined
      }
      viewportHeight={viewportHeight}
      width={width}
      onToggleOpen={handleToggle}
    />
  );
}

function disambiguateFlatTitles(
  ids: readonly string[],
  pages: Record<string, Page>,
) {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const page = pages[id];
    if (!page) continue;
    const title = sidebarPageTitle(page);
    const list = groups.get(title) ?? [];
    list.push(id);
    groups.set(title, list);
  }
  const labels = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    for (const id of group) {
      const page = pages[id];
      if (!page) continue;
      labels.set(id, parentTitleHint(page, pages));
    }
  }
  return labels;
}

function disambiguateVisibleFavorites(ids: readonly string[]) {
  const pages = usePages.getState().pages;
  const labels = new Map<string, string>();
  for (const id of ids) {
    if (!id) continue;
    const page = pages[id];
    if (!page) continue;
    const title = sidebarPageTitle(page);
    if (favoriteTitleCount(page.workspaceId, title) <= 1) continue;
    labels.set(id, parentTitleHint(page, pages));
  }
  return labels;
}

function parentTitleHint(page: Page, pages: Record<string, Page>) {
  const segments: string[] = [];
  const seen = new Set<string>();
  let parentId = page.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = pages[parentId];
    if (!parent || parent.trashedAt) break;
    segments.push(sidebarPageTitle(parent));
    parentId = parent.parentId;
  }
  return segments.length > 0 ? segments.reverse().join("/") : "根级";
}
