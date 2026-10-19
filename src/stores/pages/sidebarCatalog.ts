import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { useNotebooks } from "@/stores/useNotebooks";

/**
 * 侧栏目录：收藏、置顶、页面树、回收站都读这里。
 * 切换视图只取已排好的 id，不扫描 pages。
 * 单页更新走 hint，避免为了找一个改动去遍历全部页面。
 */

const EMPTY_IDS: readonly string[] = [];
const PATCH_REBUILD_LIMIT = 2048;

const titleCache = new WeakMap<Page, string>();

export function sidebarPageTitle(page: Page): string {
  const cached = titleCache.get(page);
  if (cached !== undefined) return cached;
  const title = getPageTitle(page);
  titleCache.set(page, title);
  return title;
}

type Hint = readonly string[] | "rebuild";

let pendingHint: Hint | undefined;
let catalog: Catalog | null = null;
let version = 0;
const listeners = new Set<() => void>();

interface Catalog {
  pages: Record<string, Page>;
  notebookIds: Set<string>;
  /** 树展示顺序。不含回收站、不含未落盘草稿。 */
  treeChildren: Map<string, string[]>;
  treeIndex: Map<string, number>;
  /** getChildren 顺序。含未落盘草稿，不含回收站。 */
  orderChildren: Map<string, string[]>;
  favoriteIds: Map<string, string[]>;
  favoriteIdsAll: string[];
  favoriteTitleCounts: Map<string, Map<string, number>>;
  favoriteOrderMax: Map<string, number>;
  pinnedIds: string[];
  pinnedIndex: Map<string, number>;
  trashedIds: Map<string, string[]>;
  /** 非回收站页面按 order 升序，取落地页。 */
  landingIds: Map<string, string[]>;
  liveCount: Map<string, number>;
}

export function hintSidebarPages(ids: Hint) {
  pendingHint = ids;
}

export function clearSidebarPageHint() {
  pendingHint = undefined;
}

function childKey(notebookId: string, parentId: string | undefined) {
  return `${notebookId}\0${parentId ?? ""}`;
}

function notebookOf(page: Page) {
  return page.workspaceId || "";
}

function parentOf(page: Page) {
  return page.parentId || undefined;
}

function isLocalNotebook(notebookId: string) {
  if (!notebookId) return false;
  return (
    useNotebooks.getState().notebooks[notebookId]?.source === "local-folder"
  );
}

function compareId(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function orderValue(page: Page) {
  return page.order ?? page.createdAt;
}

function favoriteValue(page: Page) {
  return page.favoriteOrder ?? page.order ?? page.createdAt;
}

function compareOrder(pages: Record<string, Page>, a: string, b: string) {
  const diff = orderValue(pages[a]) - orderValue(pages[b]);
  if (diff !== 0) return diff;
  return compareId(a, b);
}

function compareFavorite(pages: Record<string, Page>, a: string, b: string) {
  const diff = favoriteValue(pages[a]) - favoriteValue(pages[b]);
  if (diff !== 0) return diff;
  return compareId(a, b);
}

function comparePinned(pages: Record<string, Page>, a: string, b: string) {
  const pinDiff = (pages[b].pinnedAt ?? 0) - (pages[a].pinnedAt ?? 0);
  if (pinDiff !== 0) return pinDiff;
  const updatedDiff = pages[b].updatedAt - pages[a].updatedAt;
  if (updatedDiff !== 0) return updatedDiff;
  return compareId(a, b);
}

function compareTrashed(pages: Record<string, Page>, a: string, b: string) {
  const diff = (pages[b].trashedAt ?? 0) - (pages[a].trashedAt ?? 0);
  if (diff !== 0) return diff;
  return compareId(a, b);
}

function compareTree(
  pages: Record<string, Page>,
  local: boolean,
  a: string,
  b: string,
) {
  const pageA = pages[a];
  const pageB = pages[b];
  if (!!pageA.localPendingCreate !== !!pageB.localPendingCreate) {
    return pageA.localPendingCreate ? -1 : 1;
  }
  if (local) {
    if (!!pageA.isFolder !== !!pageB.isFolder) return pageA.isFolder ? -1 : 1;
    const byName = sidebarPageTitle(pageA).localeCompare(
      sidebarPageTitle(pageB),
      "zh-CN",
      { numeric: true },
    );
    if (byName !== 0) return byName;
    return compareId(a, b);
  }
  return compareOrder(pages, a, b);
}

function insertSorted(
  ids: string[],
  id: string,
  compare: (a: string, b: string) => number,
) {
  let lo = 0;
  let hi = ids.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compare(ids[mid], id) <= 0) lo = mid + 1;
    else hi = mid;
  }
  ids.splice(lo, 0, id);
  return lo;
}

function emptyCatalog(pages: Record<string, Page>): Catalog {
  return {
    pages,
    notebookIds: new Set(),
    treeChildren: new Map(),
    treeIndex: new Map(),
    orderChildren: new Map(),
    favoriteIds: new Map(),
    favoriteIdsAll: [],
    favoriteTitleCounts: new Map(),
    favoriteOrderMax: new Map(),
    pinnedIds: [],
    pinnedIndex: new Map(),
    trashedIds: new Map(),
    landingIds: new Map(),
    liveCount: new Map(),
  };
}

function listFor(map: Map<string, string[]>, key: string) {
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  return list;
}

function reindexTreeTail(
  catalog: Catalog,
  ids: string[],
  from: number,
) {
  for (let index = from; index < ids.length; index += 1) {
    catalog.treeIndex.set(ids[index], index);
  }
}

function reindexPinnedFrom(catalog: Catalog, from: number) {
  for (let index = from; index < catalog.pinnedIds.length; index += 1) {
    catalog.pinnedIndex.set(catalog.pinnedIds[index], index);
  }
}

function bumpFavoriteTitle(
  catalog: Catalog,
  notebookId: string,
  title: string,
  delta: number,
) {
  let counts = catalog.favoriteTitleCounts.get(notebookId);
  if (!counts) {
    counts = new Map();
    catalog.favoriteTitleCounts.set(notebookId, counts);
  }
  const next = (counts.get(title) ?? 0) + delta;
  if (next <= 0) counts.delete(title);
  else counts.set(title, next);
}

function rememberFavoriteMax(catalog: Catalog, notebookId: string, page: Page) {
  const value = favoriteValue(page);
  const current = catalog.favoriteOrderMax.get(notebookId) ?? -1;
  if (value > current) catalog.favoriteOrderMax.set(notebookId, value);
}

function refreshFavoriteMax(
  catalog: Catalog,
  notebookId: string,
  pages: Record<string, Page>,
) {
  const ids = catalog.favoriteIds.get(notebookId);
  const last = ids && ids.length > 0 ? pages[ids[ids.length - 1]] : undefined;
  if (!last) catalog.favoriteOrderMax.delete(notebookId);
  else catalog.favoriteOrderMax.set(notebookId, favoriteValue(last));
}

function detach(catalog: Catalog, page: Page) {
  const notebookId = notebookOf(page);
  const id = page.id;
  catalog.notebookIds.add(notebookId);

  if (!page.trashedAt) {
    const orderKey = childKey(notebookId, parentOf(page));
    const orderIds = catalog.orderChildren.get(orderKey);
    if (orderIds) {
      const index = orderIds.indexOf(id);
      if (index >= 0) orderIds.splice(index, 1);
    }

    const landing = catalog.landingIds.get(notebookId);
    if (landing) {
      const index = landing.indexOf(id);
      if (index >= 0) landing.splice(index, 1);
    }

    if (!page.localUnsaved) {
      const treeKey = childKey(notebookId, parentOf(page));
      const treeIds = catalog.treeChildren.get(treeKey);
      const index = catalog.treeIndex.get(id);
      if (treeIds && index !== undefined && treeIds[index] === id) {
        treeIds.splice(index, 1);
        catalog.treeIndex.delete(id);
        reindexTreeTail(catalog, treeIds, index);
      } else if (treeIds) {
        const found = treeIds.indexOf(id);
        if (found >= 0) {
          treeIds.splice(found, 1);
          catalog.treeIndex.delete(id);
          reindexTreeTail(catalog, treeIds, found);
        }
      }
      const live = catalog.liveCount.get(notebookId) ?? 0;
      if (live <= 1) catalog.liveCount.delete(notebookId);
      else catalog.liveCount.set(notebookId, live - 1);
    }
  } else {
    const trashed = catalog.trashedIds.get(notebookId);
    if (trashed) {
      const index = trashed.indexOf(id);
      if (index >= 0) trashed.splice(index, 1);
    }
  }

  if (!page.trashedAt && page.isFavorite) {
    const favorites = catalog.favoriteIds.get(notebookId);
    if (favorites) {
      const index = favorites.indexOf(id);
      if (index >= 0) favorites.splice(index, 1);
    }
    const globalIndex = catalog.favoriteIdsAll.indexOf(id);
    if (globalIndex >= 0) catalog.favoriteIdsAll.splice(globalIndex, 1);
    bumpFavoriteTitle(catalog, notebookId, sidebarPageTitle(page), -1);
    refreshFavoriteMax(catalog, notebookId, catalog.pages);
  }

  if (!page.trashedAt && page.isPinned) {
    const index = catalog.pinnedIndex.get(id);
    if (index !== undefined && catalog.pinnedIds[index] === id) {
      catalog.pinnedIds.splice(index, 1);
      catalog.pinnedIndex.delete(id);
      reindexPinnedFrom(catalog, index);
    }
  }
}

function attach(catalog: Catalog, page: Page) {
  const pages = catalog.pages;
  const notebookId = notebookOf(page);
  const id = page.id;
  catalog.notebookIds.add(notebookId);
  const local = isLocalNotebook(notebookId);

  if (!page.trashedAt) {
    const orderIds = listFor(
      catalog.orderChildren,
      childKey(notebookId, parentOf(page)),
    );
    insertSorted(orderIds, id, (a, b) => compareOrder(pages, a, b));

    const landing = listFor(catalog.landingIds, notebookId);
    insertSorted(landing, id, (a, b) => compareOrder(pages, a, b));

    if (!page.localUnsaved) {
      const treeIds = listFor(
        catalog.treeChildren,
        childKey(notebookId, parentOf(page)),
      );
      const index = insertSorted(treeIds, id, (a, b) =>
        compareTree(pages, local, a, b),
      );
      reindexTreeTail(catalog, treeIds, index);
      catalog.liveCount.set(notebookId, (catalog.liveCount.get(notebookId) ?? 0) + 1);
    }
  } else {
    const trashed = listFor(catalog.trashedIds, notebookId);
    insertSorted(trashed, id, (a, b) => compareTrashed(pages, a, b));
  }

  if (!page.trashedAt && page.isFavorite) {
    const favorites = listFor(catalog.favoriteIds, notebookId);
    insertSorted(favorites, id, (a, b) => compareFavorite(pages, a, b));
    insertSorted(catalog.favoriteIdsAll, id, (a, b) =>
      compareFavorite(pages, a, b),
    );
    bumpFavoriteTitle(catalog, notebookId, sidebarPageTitle(page), 1);
    rememberFavoriteMax(catalog, notebookId, page);
  }

  if (!page.trashedAt && page.isPinned) {
    const index = insertSorted(catalog.pinnedIds, id, (a, b) =>
      comparePinned(pages, a, b),
    );
    reindexPinnedFrom(catalog, index);
  }
}

function sameSidebarPlace(prev: Page, next: Page) {
  return (
    notebookOf(prev) === notebookOf(next) &&
    parentOf(prev) === parentOf(next) &&
    !!prev.trashedAt === !!next.trashedAt &&
    (prev.trashedAt ?? 0) === (next.trashedAt ?? 0) &&
    orderValue(prev) === orderValue(next) &&
    !!prev.localUnsaved === !!next.localUnsaved &&
    (prev.localPendingCreate ?? "") === (next.localPendingCreate ?? "") &&
    !!prev.isFolder === !!next.isFolder &&
    (prev.localFilePath ?? "") === (next.localFilePath ?? "") &&
    !!prev.isFavorite === !!next.isFavorite &&
    favoriteValue(prev) === favoriteValue(next) &&
    !!prev.isPinned === !!next.isPinned &&
    (prev.pinnedAt ?? 0) === (next.pinnedAt ?? 0) &&
    (!prev.isPinned || prev.updatedAt === next.updatedAt) &&
    sidebarPageTitle(prev) === sidebarPageTitle(next)
  );
}

function sameSidebarDisplay(prev: Page, next: Page) {
  return (
    (prev.icon ?? "") === (next.icon ?? "") &&
    (prev.localReadState ?? "") === (next.localReadState ?? "") &&
    prev.updatedAt === next.updatedAt
  );
}

function pushUnsorted(built: Catalog, page: Page) {
  const notebookId = notebookOf(page);
  const id = page.id;
  built.notebookIds.add(notebookId);
  if (!page.trashedAt) {
    listFor(built.orderChildren, childKey(notebookId, parentOf(page))).push(id);
    listFor(built.landingIds, notebookId).push(id);
    if (!page.localUnsaved) {
      listFor(built.treeChildren, childKey(notebookId, parentOf(page))).push(id);
      built.liveCount.set(notebookId, (built.liveCount.get(notebookId) ?? 0) + 1);
    }
    if (page.isFavorite) {
      listFor(built.favoriteIds, notebookId).push(id);
      built.favoriteIdsAll.push(id);
      bumpFavoriteTitle(built, notebookId, sidebarPageTitle(page), 1);
    }
    if (page.isPinned) built.pinnedIds.push(id);
  } else {
    listFor(built.trashedIds, notebookId).push(id);
  }
}

function sortIdList(
  ids: string[],
  compare: (a: string, b: string) => number,
) {
  ids.sort(compare);
}

function sortCatalog(built: Catalog) {
  const pages = built.pages;
  const localByNotebook = new Map<string, boolean>();
  const isLocal = (notebookId: string) => {
    let local = localByNotebook.get(notebookId);
    if (local === undefined) {
      local = isLocalNotebook(notebookId);
      localByNotebook.set(notebookId, local);
    }
    return local;
  };
  for (const [key, ids] of built.orderChildren) {
    sortIdList(ids, (a, b) => compareOrder(pages, a, b));
    void key;
  }
  for (const [key, ids] of built.treeChildren) {
    const notebookId = key.slice(0, key.indexOf("\0"));
    const local = isLocal(notebookId);
    sortIdList(ids, (a, b) => compareTree(pages, local, a, b));
    for (let index = 0; index < ids.length; index += 1) {
      built.treeIndex.set(ids[index], index);
    }
  }
  for (const [notebookId, ids] of built.favoriteIds) {
    sortIdList(ids, (a, b) => compareFavorite(pages, a, b));
    const last = ids.length > 0 ? pages[ids[ids.length - 1]] : undefined;
    if (last) built.favoriteOrderMax.set(notebookId, favoriteValue(last));
  }
  sortIdList(built.favoriteIdsAll, (a, b) => compareFavorite(pages, a, b));
  sortIdList(built.pinnedIds, (a, b) => comparePinned(pages, a, b));
  for (let index = 0; index < built.pinnedIds.length; index += 1) {
    built.pinnedIndex.set(built.pinnedIds[index], index);
  }
  for (const ids of built.trashedIds.values()) {
    sortIdList(ids, (a, b) => compareTrashed(pages, a, b));
  }
  for (const ids of built.landingIds.values()) {
    sortIdList(ids, (a, b) => compareOrder(pages, a, b));
  }
}

function rebuild(next: Record<string, Page>) {
  const built = emptyCatalog(next);
  for (const id in next) {
    const page = next[id];
    if (page) pushUnsorted(built, page);
  }
  sortCatalog(built);
  catalog = built;
}

function patchIds(
  prev: Record<string, Page>,
  next: Record<string, Page>,
  ids: readonly string[],
) {
  if (!catalog) {
    rebuild(next);
    return true;
  }
  catalog.pages = next;
  let changed = false;
  for (const id of ids) {
    const previous = prev[id];
    const page = next[id];
    if (previous === page) continue;
    if (previous && page && sameSidebarPlace(previous, page)) {
      if (!sameSidebarDisplay(previous, page)) changed = true;
      continue;
    }
    if (previous) detach(catalog, previous);
    if (page) attach(catalog, page);
    changed = true;
  }
  return changed;
}

function diffIds(prev: Record<string, Page>, next: Record<string, Page>) {
  const changed: string[] = [];
  const removed: string[] = [];
  for (const id in next) {
    if (prev[id] !== next[id]) changed.push(id);
  }
  for (const id in prev) {
    if (!Object.prototype.hasOwnProperty.call(next, id)) removed.push(id);
  }
  return { changed, removed };
}

export function syncSidebarCatalog(
  prev: Record<string, Page> | null,
  next: Record<string, Page>,
): boolean {
  const hint = pendingHint;
  pendingHint = undefined;

  if (catalog && catalog.pages === next) return false;
  if (!prev || !catalog || hint === "rebuild") {
    rebuild(next);
    return true;
  }
  if (Array.isArray(hint) && hint.length > 0) {
    return patchIds(prev, next, hint);
  }

  const { changed, removed } = diffIds(prev, next);
  if (changed.length === 0 && removed.length === 0) {
    catalog.pages = next;
    return false;
  }
  if (changed.length + removed.length > PATCH_REBUILD_LIMIT) {
    rebuild(next);
    return true;
  }
  return patchIds(prev, next, changed.concat(removed));
}

export function notifySidebarCatalog() {
  version += 1;
  for (const listener of listeners) listener();
}

export function ensureSidebarCatalog(pages: Record<string, Page>) {
  if (!catalog || catalog.pages !== pages) {
    syncSidebarCatalog(catalog?.pages ?? null, pages);
  }
  return catalog!;
}

export function getSidebarCatalogVersion() {
  return version;
}

export function subscribeSidebarCatalog(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSidebarCatalogVersion() {
  return useSyncExternalStore(
    subscribeSidebarCatalog,
    getSidebarCatalogVersion,
    getSidebarCatalogVersion,
  );
}

function readCatalog(pages?: Record<string, Page>) {
  if (pages) return ensureSidebarCatalog(pages);
  return catalog;
}

export function favoriteIdsFor(
  notebookId: string | null,
  pages?: Record<string, Page>,
): readonly string[] {
  const current = readCatalog(pages);
  if (!current) return EMPTY_IDS;
  if (!notebookId) return current.favoriteIdsAll;
  return current.favoriteIds.get(notebookId) ?? EMPTY_IDS;
}

export function pinnedIdsFor(pages?: Record<string, Page>): readonly string[] {
  const current = readCatalog(pages);
  return current?.pinnedIds ?? EMPTY_IDS;
}

export function pinnedPosition(id: string): number {
  return catalog?.pinnedIndex.get(id) ?? -1;
}

export function trashedIdsFor(
  notebookId: string | null,
  pages?: Record<string, Page>,
): readonly string[] {
  const current = readCatalog(pages);
  if (!current) return EMPTY_IDS;
  if (!notebookId) {
    const merged: string[] = [];
    for (const ids of current.trashedIds.values()) merged.push(...ids);
    merged.sort((a, b) => {
      const diff = (current.pages[b]?.trashedAt ?? 0) - (current.pages[a]?.trashedAt ?? 0);
      if (diff !== 0) return diff;
      return compareId(a, b);
    });
    return merged;
  }
  return current.trashedIds.get(notebookId) ?? EMPTY_IDS;
}

export function treeChildIds(
  notebookId: string,
  parentId: string | undefined,
  pages?: Record<string, Page>,
): readonly string[] {
  const current = readCatalog(pages);
  if (!current || !notebookId) return EMPTY_IDS;
  return current.treeChildren.get(childKey(notebookId, parentId)) ?? EMPTY_IDS;
}

export function treeIndexOf(id: string): number {
  return catalog?.treeIndex.get(id) ?? -1;
}

export function orderChildPages(
  pages: Record<string, Page>,
  parentId: string | undefined,
  workspaceId: string | undefined,
): Page[] {
  const current = ensureSidebarCatalog(pages);
  const collect = (notebookId: string) => {
    const ids =
      current.orderChildren.get(childKey(notebookId, parentId)) ?? EMPTY_IDS;
    const result: Page[] = [];
    for (const id of ids) {
      const page = pages[id];
      if (page) result.push(page);
    }
    return result;
  };
  if (workspaceId) return collect(workspaceId);
  const merged: Page[] = [];
  for (const notebookId of current.notebookIds) {
    merged.push(...collect(notebookId));
  }
  merged.sort((a, b) => {
    const diff = orderValue(a) - orderValue(b);
    if (diff !== 0) return diff;
    return compareId(a.id, b.id);
  });
  return merged;
}

export function landingPageId(
  notebookId: string,
  pages?: Record<string, Page>,
): string | null {
  const current = readCatalog(pages);
  if (!current) return null;
  return current.landingIds.get(notebookId)?.[0] ?? null;
}

export function notebookHasLivePages(
  notebookId: string,
  pages?: Record<string, Page>,
): boolean {
  return livePageCount(notebookId, pages) > 0;
}

export function livePageCount(
  notebookId: string,
  pages?: Record<string, Page>,
): number {
  const current = readCatalog(pages);
  return current?.liveCount.get(notebookId) ?? 0;
}

export function maxFavoriteOrder(notebookId: string): number {
  return catalog?.favoriteOrderMax.get(notebookId) ?? -1;
}

export function favoriteTitleCount(notebookId: string, title: string): number {
  return catalog?.favoriteTitleCounts.get(notebookId)?.get(title) ?? 0;
}

export function pagesByIds(
  pages: Record<string, Page>,
  ids: readonly string[],
): Page[] {
  const result: Page[] = [];
  for (const id of ids) {
    const page = pages[id];
    if (page) result.push(page);
  }
  return result;
}
