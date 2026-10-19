import { NotebookSwitcher } from "./NotebookSwitcher";
import type { Page } from "@/types";

const PINNED_SLOT = 36;
const PINNED_WINDOW = 12;
const pinnedBodyCache = new WeakMap<object, boolean>();

function windowPinnedIds(ids: readonly string[], start: number) {
  const from = Math.max(0, start);
  return ids.slice(from, from + PINNED_WINDOW);
}
import { tryShowPageInFocusedSplit } from "@/lib/editor-split/commands";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { isElectronHost } from "@/lib/local-vault";
import { useSidebarView } from "@/stores/useSidebarView";
import {
  pinnedIdsFor,
  pinnedPosition,
  sidebarPageTitle,
  useSidebarCatalogVersion,
} from "@/stores/pages/sidebarCatalog";

interface SidebarHeaderProps {
  dragGuide: {
    direction: "left" | "right";
    mode: "sort" | "nest-ready";
  } | null;
  onOpenPinnedPage?: () => void;
  selectedPageId?: string | null;
}

export function SidebarHeader({
  dragGuide,
  onOpenPinnedPage,
  selectedPageId,
}: SidebarHeaderProps) {
  const catalogVersion = useSidebarCatalogVersion();
  const activePageId = usePages((state) => state.activePageId);
  const highlightedPageId = selectedPageId ?? activePageId;
  const setExpandPageId = usePages((state) => state.setExpandPageId);
  const setPendingNavigatePageId = usePages(
    (state) => state.setPendingNavigatePageId,
  );
  const openPreviewTab = useTabs((state) => state.openPreviewTab);
  const setActiveNotebook = useNotebooks((state) => state.setActiveNotebook);
  const pinnedScrollerRef = useRef<HTMLDivElement>(null);
  const activePinnedRef = useRef<HTMLButtonElement | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollDirectionRef = useRef<"left" | "right" | null>(null);
  const [pillReady, setPillReady] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [pillBox, setPillBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [pinnedWindowStart, setPinnedWindowStart] = useState(0);
  const pinnedIds = useMemo(() => {
    void catalogVersion;
    return pinnedIdsFor(usePages.getState().pages);
  }, [catalogVersion]);
  const pinnedPages = useMemo(() => {
    const pages = usePages.getState().pages;
    const visibleIds =
      pinnedIds.length > 24 ? windowPinnedIds(pinnedIds, pinnedWindowStart) : pinnedIds;
    const result: Page[] = [];
    for (const id of visibleIds) {
      const page = pages[id];
      if (page) result.push(page);
    }
    return result;
  }, [catalogVersion, pinnedIds, pinnedWindowStart]);

  // 胶囊位置实测选中按钮的 offset*，nav 即 offsetParent，坐标不受 scrollLeft 影响
  const measurePinnedPill = useCallback(() => {
    if (pinnedIds.length > 24 && highlightedPageId) {
      const index = pinnedPosition(highlightedPageId);
      if (index >= 0) {
        const nextBox = {
          left: 4 + index * PINNED_SLOT,
          top: 4,
          width: 32,
          height: 32,
        };
        setPillBox((prev) => {
          if (
            prev &&
            prev.left === nextBox.left &&
            prev.top === nextBox.top &&
            prev.width === nextBox.width &&
            prev.height === nextBox.height
          ) {
            return prev;
          }
          return nextBox;
        });
        return;
      }
    }
    const activeButton = activePinnedRef.current;
    if (!activeButton) {
      setPillBox((prev) => (prev === null ? prev : null));
      return;
    }
    const nextBox = {
      left: activeButton.offsetLeft,
      top: activeButton.offsetTop,
      width: activeButton.offsetWidth,
      height: activeButton.offsetHeight,
    };
    setPillBox((prev) => {
      if (
        prev &&
        prev.left === nextBox.left &&
        prev.top === nextBox.top &&
        prev.width === nextBox.width &&
        prev.height === nextBox.height
      ) {
        return prev;
      }
      return nextBox;
    });
  }, [highlightedPageId, pinnedIds.length]);

  const pinnedMeasureKey = `${catalogVersion}:${pinnedIds.length}:${highlightedPageId ?? ""}`;

  useLayoutEffect(() => {
    measurePinnedPill();
  }, [measurePinnedPill, highlightedPageId, pinnedMeasureKey]);

  // 首帧不过渡，避免胶囊从容器左端飞入
  useEffect(() => {
    const rafId = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePinnedWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const scroller = pinnedScrollerRef.current;
      if (!scroller) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      scroller.scrollLeft += event.deltaY;
      event.preventDefault();
    },
    [],
  );

  const syncPinnedScrollState = useCallback(() => {
    const scroller = pinnedScrollerRef.current;
    if (!scroller) {
      setIsOverflowing(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = Math.max(
      0,
      scroller.scrollWidth - scroller.clientWidth,
    );
    const currentLeft = scroller.scrollLeft;
    const threshold = 2;

    setIsOverflowing(maxScrollLeft > threshold);
    setCanScrollLeft(currentLeft > threshold);
    setCanScrollRight(currentLeft < maxScrollLeft - threshold);
  }, []);

  const scrollPinnedBy = useCallback(
    (direction: "left" | "right") => {
      const scroller = pinnedScrollerRef.current;
      if (!scroller) return;
      const step = Math.min(260, Math.max(120, scroller.clientWidth * 0.7));
      scroller.scrollBy({
        left: direction === "left" ? -step : step,
        behavior: "smooth",
      });
      requestAnimationFrame(syncPinnedScrollState);
      window.setTimeout(syncPinnedScrollState, 220);
    },
    [syncPinnedScrollState],
  );

  const stopAutoScroll = useCallback(() => {
    autoScrollDirectionRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(
    (direction: "left" | "right") => {
      const canScroll = direction === "left" ? canScrollLeft : canScrollRight;
      if (!canScroll) return;
      autoScrollDirectionRef.current = direction;
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
      }
      const animate = () => {
        const scroller = pinnedScrollerRef.current;
        const activeDirection = autoScrollDirectionRef.current;
        if (!scroller || activeDirection !== direction) {
          stopAutoScroll();
          return;
        }

        const maxScrollLeft = Math.max(
          0,
          scroller.scrollWidth - scroller.clientWidth,
        );
        if (maxScrollLeft <= 2) {
          stopAutoScroll();
          syncPinnedScrollState();
          return;
        }

        const delta = direction === "left" ? -1.6 : 1.6;
        scroller.scrollLeft = Math.min(
          maxScrollLeft,
          Math.max(0, scroller.scrollLeft + delta),
        );
        syncPinnedScrollState();

        const atLeftEdge = scroller.scrollLeft <= 1;
        const atRightEdge = scroller.scrollLeft >= maxScrollLeft - 1;
        if (
          (direction === "left" && atLeftEdge) ||
          (direction === "right" && atRightEdge)
        ) {
          stopAutoScroll();
          return;
        }

        autoScrollFrameRef.current = requestAnimationFrame(animate);
      };

      autoScrollFrameRef.current = requestAnimationFrame(animate);
    },
    [canScrollLeft, canScrollRight, stopAutoScroll, syncPinnedScrollState],
  );

  useEffect(() => {
    const scroller = pinnedScrollerRef.current;
    if (!scroller) return;

    const handleScroll = () => {
      if (pinnedIds.length > 24) {
        const start = Math.max(
          0,
          Math.floor((scroller.scrollLeft - 4) / PINNED_SLOT) - 2,
        );
        setPinnedWindowStart((prev) => (prev === start ? prev : start));
      }
      syncPinnedScrollState();
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      syncPinnedScrollState();
      measurePinnedPill();
    });
    observer.observe(scroller);
    if (scroller.parentElement) {
      observer.observe(scroller.parentElement);
    }

    const rafId = requestAnimationFrame(syncPinnedScrollState);

    return () => {
      cancelAnimationFrame(rafId);
      scroller.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [syncPinnedScrollState, measurePinnedPill, pinnedMeasureKey]);

  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  useEffect(() => {
    if (activePinnedRef.current) {
      activePinnedRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    } else if (pinnedIds.length > 24) {
      const index = highlightedPageId ? pinnedPosition(highlightedPageId) : -1;
      const scroller = pinnedScrollerRef.current;
      if (index >= 0 && scroller) {
        const left = 4 + index * PINNED_SLOT;
        const viewRight = scroller.scrollLeft + scroller.clientWidth;
        if (left < scroller.scrollLeft || left + PINNED_SLOT > viewRight) {
          scroller.scrollLeft = Math.max(0, left - PINNED_SLOT);
          setPinnedWindowStart(Math.max(0, index - 2));
        }
      }
    }
    const rafId = requestAnimationFrame(syncPinnedScrollState);
    const timerId = window.setTimeout(syncPinnedScrollState, 220);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [activePageId, pinnedMeasureKey, syncPinnedScrollState]);

  const pageHasVisibleContent = useCallback((page: Page): boolean => {
    const content = page.content;
    if (!content || typeof content !== "object") return false;
    const cached = pinnedBodyCache.get(content);
    if (cached !== undefined) return cached;
    const visit = (node: unknown): boolean => {
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
      if (children.some((child) => visit(child))) return true;
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
    };
    const visible = visit(content);
    pinnedBodyCache.set(content, visible);
    return visible;
  }, []);

  const renderPinnedIcon = useCallback(
    (page: Page, isActive: boolean) => {
      const iconName = page.icon;
      const iconMap = LucideIcons as unknown as Record<
        string,
        React.ComponentType<{ className?: string; strokeWidth?: number }>
      >;
      const SelectedIcon = iconName ? iconMap[iconName] : null;
      // 选中态第二信号：只靠颜色不满足 WCAG 1.4.1，浅底对药丸轨道对比不足 3:1
      const strokeWidth = isActive ? 2.5 : 2;

      if (iconName) {
        if (SelectedIcon) {
          return (
            <SelectedIcon
              className="h-4 w-4 transition-transform duration-100"
              strokeWidth={strokeWidth}
            />
          );
        }
        return (
          <span className="text-sm leading-none transition-transform duration-100">
            {iconName}
          </span>
        );
      }

      if (page.isFolder) {
        return (
          <LucideIcons.Folder
            className="h-4 w-4 transition-transform duration-100"
            strokeWidth={strokeWidth}
          />
        );
      }

      const DefaultIcon = pageHasVisibleContent(page)
        ? LucideIcons.FileText
        : LucideIcons.File;
      return (
        <DefaultIcon
          className="h-4 w-4 transition-transform duration-100"
          strokeWidth={strokeWidth}
        />
      );
    },
    [pageHasVisibleContent],
  );

  const handleOpenPinnedPage = useCallback(
    (pageId: string) => {
      const targetPage = usePages.getState().getPage(pageId);
      if (!targetPage || targetPage.trashedAt) return;
      closeNotebookAiIfFullscreen();
      onOpenPinnedPage?.();

      if (useNotebooks.getState().activeNotebookId !== targetPage.workspaceId) {
        setPendingNavigatePageId(targetPage.id);
        setActiveNotebook(targetPage.workspaceId);
      }
      if (
        isElectronHost &&
        targetPage.isFolder &&
        useNotebooks.getState().notebooks[targetPage.workspaceId]?.source ===
          "local-folder"
      ) {
        useSidebarView.getState().expand(targetPage.workspaceId, targetPage.id);
        setExpandPageId(targetPage.id);
        return;
      }
      if (tryShowPageInFocusedSplit(targetPage.id)) {
        setExpandPageId(targetPage.id);
        return;
      }
      openPreviewTab(targetPage.id);
      setExpandPageId(targetPage.id);
    },
    [
      onOpenPinnedPage,
      openPreviewTab,
      setActiveNotebook,
      setExpandPageId,
      setPendingNavigatePageId,
    ],
  );

  return (
    <>
      <div className="flex h-12 shrink-0 items-start pt-0 pr-2">
        <div className="flex items-center w-full">
          <NotebookSwitcher />
        </div>
      </div>

      <div className="pb-2 pr-2 pt-0">
        {(pinnedPages.length > 0 || dragGuide) && (
          <div className="group/pinned relative min-h-10">
            {/* 药丸底与滚动层分离：滚动层不再被 rounded-full 裁掉选中态的阴影与描边 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-[#F1F1F1] dark:bg-[hsl(var(--goose-selected-bg)/0.88)]"
            />
            {dragGuide && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-full border border-primary/35 bg-[hsl(var(--background)/0.98)] px-3 text-[11px] font-medium text-primary shadow-sm backdrop-blur-sm">
                {dragGuide.mode === "sort" && "拖到页面中部，可放入为子页面"}
                {dragGuide.mode === "nest-ready" && "松手即可放入目标页面"}
              </div>
            )}
            {pinnedPages.length > 0 && (
              <nav
                aria-label="置顶页面"
                ref={pinnedScrollerRef}
                className={cn(
                  "relative flex items-center overflow-x-auto px-1 py-1 scroll-px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  pinnedIds.length > 24 ? "gap-0" : "gap-1",
                )}
                onWheel={handlePinnedWheel}
              >
                {pinnedIds.length > 24 && (
                  <div
                    aria-hidden
                    className="h-8 shrink-0"
                    style={{ width: pinnedWindowStart * PINNED_SLOT }}
                  />
                )}
                {pillBox && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute left-0 top-0 rounded-full",
                      "bg-[var(--goose-interactive-selected)] shadow-sm",
                      pillReady
                        ? "transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                        : "transition-none",
                    )}
                    style={{
                      transform: `translate3d(${pillBox.left}px, ${pillBox.top}px, 0)`,
                      width: pillBox.width,
                      height: pillBox.height,
                    }}
                  />
                )}
                {pinnedPages.map((page) => {
                  const isActive = highlightedPageId === page.id;
                  const title = sidebarPageTitle(page);
                  const button = (
                    <button
                      ref={isActive ? activePinnedRef : null}
                      type="button"
                      aria-label={title}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative z-[1] h-8 w-8 shrink-0 scroll-mx-1 rounded-full inline-flex items-center justify-center",
                        "transition-colors duration-150 active:[&_svg]:scale-[0.97]",
                        "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--goose-interactive-selected-fg)]",
                        isActive
                          ? "text-[var(--goose-interactive-selected-fg)]"
                          : "text-muted-foreground hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
                      )}
                      onClick={() => handleOpenPinnedPage(page.id)}
                    >
                      {renderPinnedIcon(page, isActive)}
                    </button>
                  );
                  return (
                    <TooltipProvider key={page.id} delayDuration={600}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {pinnedIds.length > 24 ? (
                            <span
                              className="inline-flex h-8 w-9 shrink-0 items-center justify-start"
                              style={{ width: PINNED_SLOT }}
                            >
                              {button}
                            </span>
                          ) : (
                            button
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{title}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {pinnedIds.length > 24 && (
                  <div
                    aria-hidden
                    className="h-8 shrink-0"
                    style={{
                      width: Math.max(
                        0,
                        (pinnedIds.length - pinnedWindowStart - pinnedPages.length) *
                          PINNED_SLOT,
                      ),
                    }}
                  />
                )}
              </nav>
            )}

            {pinnedPages.length > 0 && (
              <>
                <div
                  className={cn(
                    "pointer-events-none absolute left-1 top-1 bottom-1 z-10 w-5 rounded-l-full bg-gradient-to-r from-[#F1F1F1] to-transparent dark:from-[hsl(var(--goose-selected-bg)/0.88)] transition-opacity duration-200",
                    canScrollLeft ? "opacity-100" : "opacity-0",
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute right-1 top-1 bottom-1 z-10 w-5 rounded-r-full bg-gradient-to-l from-[#F1F1F1] to-transparent dark:from-[hsl(var(--goose-selected-bg)/0.88)] transition-opacity duration-200",
                    canScrollRight ? "opacity-100" : "opacity-0",
                  )}
                />

                <button
                  type="button"
                  aria-label="向左查看置顶页面"
                  onClick={() => scrollPinnedBy("left")}
                  onMouseEnter={() => startAutoScroll("left")}
                  onMouseLeave={stopAutoScroll}
                  onFocus={() => startAutoScroll("left")}
                  onBlur={stopAutoScroll}
                  className={cn(
                    "absolute left-1 top-1/2 z-[11] -translate-y-1/2 h-6 w-6 rounded-full border border-border/30 bg-background/80 text-muted-foreground backdrop-blur-sm transition-all duration-150",
                    "inline-flex items-center justify-center shadow-sm",
                    isOverflowing && canScrollLeft
                      ? "group-hover/pinned:opacity-100 group-focus-within/pinned:opacity-100 group-hover/pinned:translate-x-0 group-focus-within/pinned:translate-x-0"
                      : "",
                    canScrollLeft
                      ? "opacity-0 -translate-x-1"
                      : "opacity-0 -translate-x-2 pointer-events-none",
                    "hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
                  )}
                >
                  <LucideIcons.ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  aria-label="向右查看置顶页面"
                  onClick={() => scrollPinnedBy("right")}
                  onMouseEnter={() => startAutoScroll("right")}
                  onMouseLeave={stopAutoScroll}
                  onFocus={() => startAutoScroll("right")}
                  onBlur={stopAutoScroll}
                  className={cn(
                    "absolute right-1 top-1/2 z-[11] -translate-y-1/2 h-6 w-6 rounded-full border border-border/30 bg-background/80 text-muted-foreground backdrop-blur-sm transition-all duration-150",
                    "inline-flex items-center justify-center shadow-sm",
                    isOverflowing && canScrollRight
                      ? "group-hover/pinned:opacity-100 group-focus-within/pinned:opacity-100 group-hover/pinned:translate-x-0 group-focus-within/pinned:translate-x-0"
                      : "",
                    canScrollRight
                      ? "opacity-0 translate-x-1"
                      : "opacity-0 translate-x-2 pointer-events-none",
                    "hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
                  )}
                >
                  <LucideIcons.ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
