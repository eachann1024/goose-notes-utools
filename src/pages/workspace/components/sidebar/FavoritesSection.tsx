import { memo } from "react";
import type { Page } from "@/types";
import * as LucideIcons from "lucide-react";
import { SidebarTree } from "./SidebarTree";
import {
  favoriteIdsFor,
  useSidebarCatalogVersion,
} from "@/stores/pages/sidebarCatalog";

interface FavoritesSectionProps {
  width: number;
  rowHeight: number;
  itemHeight: number;
  onCreatePage: () => void;
}

const FLAT_VIRTUAL_THRESHOLD = 48;

export const FavoritesSection = memo(function FavoritesSection({
  width,
  rowHeight,
  itemHeight,
  onCreatePage,
}: FavoritesSectionProps) {
  const catalogVersion = useSidebarCatalogVersion();
  const reorderFavorites = usePages((state) => state.reorderFavorites);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);
  const favoritesCollapsed = useSidebarView((s) => s.favoritesCollapsed);
  const setFavoritesCollapsed = useSidebarView((s) => s.setFavoritesCollapsed);

  const favoriteRootIds = useMemo(() => {
    void catalogVersion;
    return favoriteIdsFor(activeNotebookId, usePages.getState().pages);
  }, [activeNotebookId, catalogVersion]);

  const resolveFavoriteSiblings = useCallback(
    (parentId: string | undefined) => {
      if (parentId) return [];
      const pages = usePages.getState().pages;
      const ids = favoriteIdsFor(activeNotebookId, pages);
      const siblings: Page[] = [];
      for (const id of ids) {
        const page = pages[id];
        if (page) siblings.push(page);
      }
      return siblings;
    },
    [activeNotebookId],
  );

  const handleReorderFavorites = useCallback(
    (ids: string[], parentId: string | undefined) => {
      if (parentId) return;
      reorderFavorites(ids);
    },
    [reorderFavorites],
  );

  if (favoriteRootIds.length === 0) return null;

  const virtual = favoriteRootIds.length > FLAT_VIRTUAL_THRESHOLD;

  return (
    <div className="py-1">
      <div
        className="sidebar-section-label sidebar-favorites-label group flex h-8 cursor-pointer items-center justify-between rounded-lg pr-2 text-xs font-medium text-[hsl(var(--goose-nav-title))] transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
        onClick={() => setFavoritesCollapsed(!favoritesCollapsed)}
      >
        <span className="inline-flex h-8 items-center leading-none">收藏</span>
        <span className="inline-flex h-4 w-4 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          {favoritesCollapsed ? (
            <LucideIcons.ChevronRight className="h-3 w-3" />
          ) : (
            <LucideIcons.ChevronDown className="h-3 w-3" />
          )}
        </span>
      </div>

      <div
        hidden={favoritesCollapsed}
        className={favoritesCollapsed ? "hidden" : undefined}
        style={
          virtual
            ? {
                height: Math.min(320, favoriteRootIds.length * rowHeight),
                overflow: "hidden",
              }
            : undefined
        }
      >
        <div className={virtual ? "h-full overflow-hidden" : "overflow-hidden"}>
          <SidebarTree
            activeNotebookId={activeNotebookId}
            width={width}
            rowHeight={rowHeight}
            itemHeight={itemHeight}
            viewportHeight={virtual ? Math.min(320, favoriteRootIds.length * rowHeight) : 0}
            onCreatePage={onCreatePage}
            rootPageIds={favoriteRootIds}
            flatRoots
            fitContent={!virtual}
            showEmptyState={false}
            allowNest={false}
            resolveSiblings={resolveFavoriteSiblings}
            onReorder={handleReorderFavorites}
            showAddChildButton={false}
            draggablePageIds={virtual ? undefined : favoriteRootIds}
          />
        </div>
      </div>
    </div>
  );
});
