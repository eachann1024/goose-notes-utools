import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { TreeInformation, TreeItem, TreeItemIndex, TreeItemRenderContext } from "react-complex-tree";
import type { Page } from "@/types";
import { treeChildIds, treeIndexOf } from "@/stores/pages/sidebarCatalog";
import {
  indexInTreeSpans,
  locateTreeRow,
  type TreeSpan,
} from "./treeRanges";
import { renderItem, renderItemArrow } from "./MainTreeItem";

const MAX_TRACK_ROWS = 4000;
const VIEW_CAP = 36;

function trackHeight(count: number, rowHeight: number) {
  return Math.min(Math.max(count, 0), MAX_TRACK_ROWS) * Math.max(1, rowHeight);
}

function visibleRowCount(viewport: number, rowHeight: number) {
  const safeRow = Math.max(1, rowHeight);
  return Math.min(VIEW_CAP, Math.ceil(Math.min(Math.max(viewport, 1), 800) / safeRow) + 8);
}

function startIndexForScroll(
  scrollTop: number,
  count: number,
  rowHeight: number,
  viewport: number,
) {
  const visible = visibleRowCount(viewport, rowHeight);
  const height = trackHeight(count, rowHeight);
  const maxScroll = Math.max(1, height - viewport);
  const progress = height <= viewport ? 0 : Math.min(1, Math.max(0, scrollTop) / maxScroll);
  const maxStart = Math.max(0, count - visible);
  return Math.min(maxStart, Math.floor(progress * maxStart));
}

interface VirtualMainTreeProps {
  spans: readonly TreeSpan[];
  count: number;
  pages: Record<string, Page>;
  rowHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  highlightedPageId: string | null;
  isLocalFolder: boolean;
  expandedIds: readonly string[];
  scrollToPageRef: RefObject<(pageId: string) => void>;
  onOpenPage: (pageId: string, mode: "preview" | "permanent") => void;
  onMove: (dragId: string, parentId: string | undefined, childIndex: number) => void;
  onCreateLocalFile?: (parentId?: string) => void;
  onCreateLocalFolder?: (parentId?: string) => void;
  onCommitPendingCreate?: (id: string, name: string) => void;
  onCancelPendingCreate?: (id: string) => void;
  onItemDragStart?: (id: string) => void;
  onItemDragEnd?: () => void;
  onActivateLocalDirectory?: (pageId: string, mode: "preview" | "permanent") => void;
}

export function VirtualMainTree({
  spans,
  count,
  pages,
  rowHeight,
  scrollRef,
  highlightedPageId,
  isLocalFolder,
  expandedIds,
  scrollToPageRef,
  onOpenPage,
  onMove,
  onCreateLocalFile,
  onCreateLocalFolder,
  onCommitPendingCreate,
  onCancelPendingCreate,
  onItemDragStart,
  onItemDragEnd,
  onActivateLocalDirectory,
}: VirtualMainTreeProps) {
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);
  const dragIdRef = useRef<string | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(480);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const publish = () => {
      if (element.hidden || element.clientHeight === 0) return;
      const next = element.clientHeight;
      setViewport((prev) => (prev === next ? prev : next));
      const start = startIndexForScroll(element.scrollTop, count, rowHeight, next);
      setWindowStart((prev) => (prev === start ? prev : start));
      setScrollTop((prev) => (prev === element.scrollTop ? prev : element.scrollTop));
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    element.addEventListener("scroll", publish, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", publish);
    };
  }, [count, rowHeight, scrollRef]);

  useEffect(() => {
    scrollToPageRef.current = (pageId: string) => {
      const page = pages[pageId];
      const index = indexInTreeSpans(
        spans,
        pageId,
        page?.parentId || undefined,
        treeIndexOf(pageId),
      );
      const element = scrollRef.current;
      if (!element || index < 0) return;
      const visible = visibleRowCount(element.clientHeight || viewport, rowHeight);
      const maxStart = Math.max(0, count - visible);
      const start = Math.max(0, Math.min(maxStart, index - 4));
      const height = trackHeight(count, rowHeight);
      const maxScroll = Math.max(0, height - (element.clientHeight || viewport));
      const progress = maxStart === 0 ? 0 : start / maxStart;
      element.scrollTop = progress * maxScroll;
      setScrollTop(element.scrollTop);
      setWindowStart(start);
    };
    return () => {
      scrollToPageRef.current = () => {};
    };
  }, [count, pages, rowHeight, scrollRef, scrollToPageRef, spans, viewport]);

  useEffect(() => {
    if (!highlightedPageId) return;
    scrollToPageRef.current(highlightedPageId);
  }, [highlightedPageId, scrollToPageRef]);

  const visibleCount = visibleRowCount(viewport, rowHeight);
  const from = Math.min(windowStart, Math.max(0, count - visibleCount));
  const to = Math.min(count, from + visibleCount);
  const rows: number[] = [];
  for (let index = from; index < to; index += 1) rows.push(index);

  return (
    <div
      style={{ height: trackHeight(count, rowHeight), position: "relative", width: "100%" }}
      onDragOver={(event) => {
        if (!dragIdRef.current) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        const dragId = dragIdRef.current;
        dragIdRef.current = null;
        if (!dragId) return;
        event.preventDefault();
        const scroller = scrollRef.current;
        if (!scroller) return;
        const top = scroller.getBoundingClientRect().top;
        const local = Math.max(0, Math.floor((event.clientY - top) / Math.max(1, rowHeight)));
        const index = Math.min(count - 1, from + local);
        const located = locateTreeRow(spans, index);
        if (!located || located.id === dragId) return;
        onMove(dragId, located.parentId, located.childIndex);
      }}
    >
      {rows.map((index) => {
        const located = locateTreeRow(spans, index);
        if (!located) return null;
        const page = pages[located.id];
        if (!page) return null;
        const childCount = treeChildIds(page.workspaceId, located.id).length;
        const item = {
          index: located.id as TreeItemIndex,
          children: (childCount > 0 ? [located.id] : []) as TreeItemIndex[],
          isFolder: isLocalFolder ? !!page.isFolder : true,
          data: page,
          canMove: !page.localPendingCreate,
          canRename: false,
        } satisfies TreeItem<Page>;
        const context = {
          isSelected: highlightedPageId === located.id,
          isExpanded: expanded.has(located.id),
          isDraggingOver: false,
          isRenaming: false,
          interactiveElementProps: { draggable: true },
          itemContainerWithoutChildrenProps: {},
          itemContainerWithChildrenProps: {
            "data-rct-item-id": located.id,
          },
          arrowProps: {},
        } as unknown as TreeItemRenderContext<never>;
        const info = {
          treeId: "main",
          rootItem: "root",
        } as TreeInformation;
        return (
          <div
            key={located.id}
            style={{
              position: "absolute",
              top: scrollTop + (index - from) * Math.max(1, rowHeight),
              left: 0,
              width: "100%",
              height: rowHeight,
            }}
          >
            {renderItem({
              item,
              depth: located.depth,
              children: null,
              arrow: renderItemArrow({ item, context, info }),
              context,
              title: null,
              info,
              onCreateLocalFile,
              onCreateLocalFolder,
              onCommitPendingCreate,
              onCancelPendingCreate,
              onItemDragStart: (id) => {
                dragIdRef.current = id;
                onItemDragStart?.(id);
              },
              onItemDragEnd: () => {
                dragIdRef.current = null;
                onItemDragEnd?.();
              },
              onActivateLocalDirectory,
            })}
          </div>
        );
      })}
    </div>
  );
}
