import { useNotebooks } from "../../../useNotebooks";
import {
  assignExistingStableId,
  readLocalPageIdMap,
  toRelativePath,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";
import { markSelfWrite } from "@/lib/local-md-snapshot";
import {
  persistPageSnapshot,
  syncLocalPageMetadataCache,
} from "../../persistence";
import type { StoreSet, StoreGet } from "../hydrate";
import { isUnsavedLocalPage } from "@/lib/unsavedLocalPage";
import { cloneLocalPageContent } from "./content";
import { allocateLocalMarkdownFilePath } from "./localPathAllocation";

export const assignUnsavedLocalFilePathAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  options?: { title?: string },
): Promise<string | null> => {
  const page = get().pages[pageId];
  if (page?.localFilePath) return page.localFilePath;
  if (!isUnsavedLocalPage(page)) return null;
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  if (!notebook?.localPath) return null;

  const filePath = await allocateLocalMarkdownFilePath(
    get,
    page.workspaceId,
    page.parentId,
    options?.title,
  );
  if (!filePath) return null;

  const idMap = readLocalPageIdMap(page.workspaceId);
  const relativePath = toRelativePath(notebook.localPath, filePath);
  const assigned = assignExistingStableId(
    page.workspaceId,
    relativePath,
    pageId,
    idMap,
  );
  if (assigned.dirty) {
    writeLocalPageIdMap(page.workspaceId, idMap);
  }

  set((state) => {
    const current = state.pages[pageId];
    if (!current) return state;
    return {
      pages: {
        ...state.pages,
        [pageId]: {
          ...current,
          localFilePath: filePath,
          localUnsaved: undefined,
        },
      },
    };
  });

  const latest = get().pages[pageId];
  if (latest) {
    syncLocalPageMetadataCache(pageId, latest);
    persistPageSnapshot(latest);
  }
  return filePath;
};

export const materializeUnsavedLocalPageAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  options?: { title?: string },
): Promise<boolean> => {
  const filePath = await assignUnsavedLocalFilePathAction(
    set,
    get,
    pageId,
    options,
  );
  if (!filePath) return Boolean(get().pages[pageId]?.localFilePath);

  markSelfWrite(filePath);
  const latest = get().pages[pageId];
  if (!latest) return false;

  let saved: boolean;
  try {
    saved = await get().saveLocalPageContent(
      pageId,
      cloneLocalPageContent(latest.content),
      { force: true },
    );
  } catch {
    saved = false;
  }
  if (!saved) {
    set((state) => {
      const current = state.pages[pageId];
      if (!current) return state;
      return {
        pages: {
          ...state.pages,
          [pageId]: {
            ...current,
            localFilePath: undefined,
            localUnsaved: true,
          },
        },
      };
    });
    return false;
  }

  persistPageSnapshot(get().pages[pageId]);
  return true;
};
