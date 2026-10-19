export interface TreeSpan {
  ids: readonly string[];
  from: number;
  to: number;
  depth: number;
  start: number;
  parentId: string | undefined;
}

export interface LocatedTreeRow {
  id: string;
  depth: number;
  parentId: string | undefined;
  childIndex: number;
}

export const SIDEBAR_VIRTUAL_ROW_THRESHOLD = 250;

/**
 * 可见行用区间描述，不复制 id。
 * 没有展开项时只有一段，10 万、100 万行也是 O(1)。
 */
export function buildTreeSpans(options: {
  rootParentId?: string | undefined;
  expandedIds: readonly string[];
  childIds: (parentId: string | undefined) => readonly string[];
  parentIdOf: (id: string) => string | undefined;
  indexOf: (id: string) => number;
  isIncluded?: (id: string) => boolean;
}): { spans: TreeSpan[]; count: number } {
  const { expandedIds, childIds, parentIdOf, indexOf, isIncluded } = options;
  const expandedSet = new Set(expandedIds);
  const indexesByParent = new Map<string, number[]>();

  const parentKey = (parentId: string | undefined) => parentId ?? "";

  const ancestorsOpen = (id: string) => {
    let parentId = parentIdOf(id);
    const seen = new Set<string>();
    while (parentId) {
      if (seen.has(parentId) || !expandedSet.has(parentId)) return false;
      seen.add(parentId);
      parentId = parentIdOf(parentId);
    }
    return true;
  };

  if (expandedSet.size > 0) {
    for (const id of expandedIds) {
      if (!expandedSet.has(id) || !ancestorsOpen(id)) continue;
      if (isIncluded && !isIncluded(id)) continue;
      const index = indexOf(id);
      if (index < 0) continue;
      const key = parentKey(parentIdOf(id));
      const indexes = indexesByParent.get(key);
      if (indexes) indexes.push(index);
      else indexesByParent.set(key, [index]);
    }
    for (const indexes of indexesByParent.values()) {
      indexes.sort((a, b) => a - b);
    }
  }

  const spans: TreeSpan[] = [];
  let cursor = 0;

  const emit = (parentId: string | undefined, depth: number) => {
    const ids = childIds(parentId);
    if (ids.length === 0) return;
    const indexes = indexesByParent.get(parentKey(parentId));
    if (!indexes || indexes.length === 0) {
      spans.push({
        ids,
        from: 0,
        to: ids.length,
        depth,
        start: cursor,
        parentId,
      });
      cursor += ids.length;
      return;
    }

    let from = 0;
    for (const index of indexes) {
      if (index < from || index >= ids.length) continue;
      const end = index + 1;
      if (end > from) {
        spans.push({
          ids,
          from,
          to: end,
          depth,
          start: cursor,
          parentId,
        });
        cursor += end - from;
      }
      emit(ids[index], depth + 1);
      from = end;
    }
    if (from < ids.length) {
      spans.push({
        ids,
        from,
        to: ids.length,
        depth,
        start: cursor,
        parentId,
      });
      cursor += ids.length - from;
    }
  };

  emit(options.rootParentId, 0);
  return { spans, count: cursor };
}

export function locateTreeRow(
  spans: readonly TreeSpan[],
  index: number,
): LocatedTreeRow | null {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const span = spans[mid];
    const spanCount = span.to - span.from;
    if (index < span.start) hi = mid - 1;
    else if (index >= span.start + spanCount) lo = mid + 1;
    else {
      const offset = index - span.start;
      return {
        id: span.ids[span.from + offset],
        depth: span.depth,
        parentId: span.parentId,
        childIndex: span.from + offset,
      };
    }
  }
  return null;
}

export function indexInTreeSpans(
  spans: readonly TreeSpan[],
  id: string,
  parentId: string | undefined,
  childIndex: number,
): number {
  if (childIndex < 0) return -1;
  for (const span of spans) {
    if (span.parentId !== parentId) continue;
    if (childIndex < span.from || childIndex >= span.to) continue;
    return span.start + (childIndex - span.from);
  }
  void id;
  return -1;
}
