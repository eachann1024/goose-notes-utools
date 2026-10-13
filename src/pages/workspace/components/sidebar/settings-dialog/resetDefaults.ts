import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import {
  QUICKNOTE_DEFAULT_HEIGHT,
  QUICKNOTE_DEFAULT_WIDTH,
  createEmptyQuickNoteDrafts,
  useQuickNote,
} from "@/stores/useQuickNote";
import { createEmptySlotStacks } from "@/lib/quicknote/undoHistory";
import { useSidebarView } from "@/stores/useSidebarView";
import { AI_INITIAL_STATE } from "@/stores/settings/slices/aiSlice";
import { APPEARANCE_INITIAL_STATE } from "@/stores/settings/slices/appearanceSlice";
import { LOCAL_FOLDER_INITIAL_STATE } from "@/stores/settings/slices/localFolderSlice";
import { SEARCH_PROVIDERS_INITIAL_STATE } from "@/stores/settings/slices/searchProvidersSlice";
import { SHORTCUTS_INITIAL_STATE } from "@/stores/settings/slices/shortcutsSlice";
import { UTOOLS_INITIAL_STATE } from "@/stores/settings/slices/utoolsSlice";
import { WEBDAV_INITIAL_STATE } from "@/stores/settings/slices/webdavSlice";
import { isElectronHost } from "./configuration";

export const createDefaultNotebook = () => {
  const now = Date.now();
  const localNotebooks = Object.fromEntries(
    Object.entries(useNotebooks.getState().notebooks).filter(
      ([, notebook]) => notebook.source === "local-folder",
    ),
  );
  // Electron 仅本地文件夹模式：重置后不种回内置本，保持空态
  if (isElectronHost) {
    useNotebooks.setState({
      notebooks: localNotebooks,
      activeNotebookId: Object.keys(localNotebooks)[0] ?? null,
      lastActivePageByNotebook: {},
      localFolderLoadStates: {},
    });
    return;
  }
  useNotebooks.setState({
    notebooks: {
      ...localNotebooks,
      [DEFAULT_NOTEBOOK]: {
        id: DEFAULT_NOTEBOOK,
        name: "Note",
        icon: "BookOpen",
        createdAt: now,
        updatedAt: now,
      },
    },
    activeNotebookId: DEFAULT_NOTEBOOK,
    lastActivePageByNotebook: {},
    localFolderLoadStates: {},
  });
};

export const resetAuxiliaryAppState = () => {
  useQuickNote.persist.clearStorage();
  useQuickNote.setState({
    activeSlot: 1,
    drafts: createEmptyQuickNoteDrafts(),
    undoStacks: createEmptySlotStacks(),
    redoStacks: createEmptySlotStacks(),
    pinned: true,
    editorZoom: 1,
    windowWidth: QUICKNOTE_DEFAULT_WIDTH,
    windowHeight: QUICKNOTE_DEFAULT_HEIGHT,
    windowX: undefined,
    windowY: undefined,
  });

  useSidebarView.persist.clearStorage();
  useSidebarView.setState({
    expandedByNotebook: {},
    focusedByNotebook: {},
    selectedByNotebook: {},
    favoritesCollapsed: false,
    sidebarCollapsed: false,
  });

  [
    "goose-recent-excludes",
    "goose-note-ai-panel-open",
    "goose-note-ai-panel-width",
    "sidebar-width",
  ].forEach((key) => window.localStorage.removeItem(key));
};

export function createSettingsResetToDefaults(resetAppsBanner: () => void) {
  const resetSettingsToDefaults = async () => {
    await useSettings.persist.clearStorage();
    useSettings.setState({
      ...structuredClone(AI_INITIAL_STATE),
      ...structuredClone(APPEARANCE_INITIAL_STATE),
      ...structuredClone(LOCAL_FOLDER_INITIAL_STATE),
      ...structuredClone(SEARCH_PROVIDERS_INITIAL_STATE),
      ...structuredClone(SHORTCUTS_INITIAL_STATE),
      ...structuredClone(UTOOLS_INITIAL_STATE),
      ...structuredClone(WEBDAV_INITIAL_STATE),
      _hasHydrated: true,
    });
    useSettings.getState().setTheme("system");
    useSettings.getState().setAccentColor(APPEARANCE_INITIAL_STATE.accentColor);
    useSettings.getState().setCodeStyle("default");
    resetAppsBanner();
  };

  return resetSettingsToDefaults;
}
