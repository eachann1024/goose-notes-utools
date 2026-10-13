import {
  SETTINGS_TABS,
  SETTINGS_APPS_BANNER_ID,
} from "./settings-dialog/configuration";
import { createSettingsDataTransferActions } from "./settings-dialog/dataTransfer";
import { clearCurrentContent } from "./settings-dialog/contentReset";
import { createSettingsBackupRestoreActions } from "./settings-dialog/backupRestore";
import {
  createDefaultNotebook,
  createSettingsResetToDefaults,
  resetAuxiliaryAppState,
} from "./settings-dialog/resetDefaults";
import { renderRecommendedAppsBanner } from "./settings-dialog/recommendedApps";
import { renderResetConfirmation } from "./settings-dialog/resetConfirmation";
import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsShortcuts } from "./settings/SettingsShortcuts";
import { SettingsLocalFolder } from "./SettingsLocalFolder";
import {
  LOCAL_FOLDER_EDITOR_CANDIDATES,
  LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  LOCAL_FOLDER_TERMINAL_CANDIDATES,
} from "@/lib/local-folder-open-apps";
import { shell } from "@/lib/utools/shell";
import { SettingsDataPanel } from "./settings/SettingsDataPanel";
import { SettingsAI } from "./SettingsAI";
import { SettingsScaffold } from "./settings/SettingsScaffold";
import type { SettingsTab } from "./settings/types";
import { useShallow } from "zustand/react/shallow";
import { useNotebooks, sortNotebooksByOrder } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useTabs } from "@/stores/useTabs";
import { usePersistentDismissState } from "@/hooks/usePersistentDismissState";
import type { ExportOptions } from "@/lib/export";
import * as LucideIcons from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  useEffect(() => {
    document.body.toggleAttribute("data-goose-settings-open", open);

    return () => {
      document.body.removeAttribute("data-goose-settings-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const prewarmLocalFolderOpenApps = () => {
      if (cancelled) return;
      void Promise.all([
        shell.listAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES),
      ]);
    };

    const schedule =
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function"
        ? () => {
            idleId = window.requestIdleCallback(() => {
              prewarmLocalFolderOpenApps();
            });
          }
        : () => {
            timeoutId = setTimeout(prewarmLocalFolderOpenApps, 0);
          };

    schedule();

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [open]);

  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    codeStyle,
    setCodeStyle,
    searchProviders,
    toggleSearchProvider,
    reorderSearchProviders,
    addCustomSearchProvider,
    updateCustomSearchProvider,
    removeCustomSearchProvider,
    ai,
    setAIEnabled,
    setAIReadGlobalPrompt,
    setAIReadLocalSkills,
    setAISelectedModelId,
    saveAICustomConfig,
    privacy,
    setAutoOpenLastNote,
    singleTabMode,
    setSingleTabMode,
    showRecentInSearch,
    setShowRecentInSearch,
    closeTabShortcut,
    setCloseTabShortcut,
    searchPanelCloseShortcut,
    setSearchPanelCloseShortcut,
    appShortcuts,
    setAppShortcut,
    resetAppShortcuts,
    customFonts,
    setCustomLabel,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
    sidebarFontSize,
    increaseSidebarFontSize,
    decreaseSidebarFontSize,
    editorFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    hideExpandArrows,
    setHideExpandArrows,
    randomIconOnCreate,
    setRandomIconOnCreate,

    customActions,
    addCustomAction,
    updateCustomAction,
    removeCustomAction,
    notebookDropdownHoverExpand,
    setNotebookDropdownHoverExpand,
    localFolderFileManager,
    setLocalFolderFileManager,
    localFolderExternalEditor,
    setLocalFolderExternalEditor,
    localFolderTerminal,
    setLocalFolderTerminal,
    localFolderHiddenFolders,
    setLocalFolderHiddenFolders,
  } = useSettings(
    useShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      accentColor: s.accentColor,
      setAccentColor: s.setAccentColor,
      codeStyle: s.codeStyle,
      setCodeStyle: s.setCodeStyle,
      searchProviders: s.searchProviders,
      toggleSearchProvider: s.toggleSearchProvider,
      reorderSearchProviders: s.reorderSearchProviders,
      addCustomSearchProvider: s.addCustomSearchProvider,
      updateCustomSearchProvider: s.updateCustomSearchProvider,
      removeCustomSearchProvider: s.removeCustomSearchProvider,
      ai: s.ai,
      setAIEnabled: s.setAIEnabled,
      setAIReadGlobalPrompt: s.setAIReadGlobalPrompt,
      setAIReadLocalSkills: s.setAIReadLocalSkills,
      setAISelectedModelId: s.setAISelectedModelId,
      saveAICustomConfig: s.saveAICustomConfig,
      privacy: s.privacy,
      setAutoOpenLastNote: s.setAutoOpenLastNote,
      singleTabMode: s.singleTabMode,
      setSingleTabMode: s.setSingleTabMode,
      showRecentInSearch: s.showRecentInSearch,
      setShowRecentInSearch: s.setShowRecentInSearch,
      closeTabShortcut: s.closeTabShortcut,
      setCloseTabShortcut: s.setCloseTabShortcut,
      searchPanelCloseShortcut: s.searchPanelCloseShortcut,
      setSearchPanelCloseShortcut: s.setSearchPanelCloseShortcut,
      appShortcuts: s.appShortcuts,
      setAppShortcut: s.setAppShortcut,
      resetAppShortcuts: s.resetAppShortcuts,
      customFonts: s.customFonts,
      setCustomLabel: s.setCustomLabel,
      setCustomFont: s.setCustomFont,
      uiFontSize: s.uiFontSize,
      setUIFontSize: s.setUIFontSize,
      sidebarFontSize: s.sidebarFontSize,
      increaseSidebarFontSize: s.increaseSidebarFontSize,
      decreaseSidebarFontSize: s.decreaseSidebarFontSize,
      editorFontSize: s.editorFontSize,
      increaseEditorFontSize: s.increaseEditorFontSize,
      decreaseEditorFontSize: s.decreaseEditorFontSize,
      hideExpandArrows: s.hideExpandArrows,
      setHideExpandArrows: s.setHideExpandArrows,
      randomIconOnCreate: s.randomIconOnCreate,
      setRandomIconOnCreate: s.setRandomIconOnCreate,

      customActions: s.customActions,
      addCustomAction: s.addCustomAction,
      updateCustomAction: s.updateCustomAction,
      removeCustomAction: s.removeCustomAction,
      notebookDropdownHoverExpand: s.notebookDropdownHoverExpand,
      setNotebookDropdownHoverExpand: s.setNotebookDropdownHoverExpand,
      localFolderFileManager: s.localFolderFileManager,
      setLocalFolderFileManager: s.setLocalFolderFileManager,
      localFolderExternalEditor: s.localFolderExternalEditor,
      setLocalFolderExternalEditor: s.setLocalFolderExternalEditor,
      localFolderTerminal: s.localFolderTerminal,
      setLocalFolderTerminal: s.setLocalFolderTerminal,
      localFolderHiddenFolders: s.localFolderHiddenFolders,
      setLocalFolderHiddenFolders: s.setLocalFolderHiddenFolders,
    })),
  );
  const { notebooks } = useNotebooks(
    useShallow((s) => ({ notebooks: s.notebooks })),
  );
  const { pages } = usePages(useShallow((s) => ({ pages: s.pages })));
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: SettingsTab }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };

    window.addEventListener("goose-note:settings-tab-change", handleTabChange);
    return () => {
      window.removeEventListener(
        "goose-note:settings-tab-change",
        handleTabChange,
      );
    };
  }, []);

  // 数据管理状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportOptions["format"]>("md");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const {
    visible: appsBannerVisible,
    dismiss: dismissAppsBanner,
    reset: resetAppsBanner,
  } = usePersistentDismissState(SETTINGS_APPS_BANNER_ID);

  const notebookList = sortNotebooksByOrder(notebooks).filter(
    (n) => n.source !== "local-folder",
  );
  const { createNotebook } = useNotebooks(
    useShallow((s) => ({ createNotebook: s.createNotebook })),
  );
  const resetPhrase = "我已知晓风险";
  const canReset = resetInput.trim() === resetPhrase;

  const toggleNotebook = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === notebookList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notebookList.map((n) => n.id));
    }
  };
  const { handleExport, handleImport } = createSettingsDataTransferActions({
    selectedIds,
    format,
    notebooks,
    pages,
    createNotebook,
    setExporting,
    setImporting,
  });

  useEffect(() => {
    if (!resetDialogOpen) {
      setResetInput("");
    }
  }, [resetDialogOpen]);
  const { restoreBackupWithRollback } =
    createSettingsBackupRestoreActions(createNotebook);
  const resetSettingsToDefaults =
    createSettingsResetToDefaults(resetAppsBanner);

  const handleReset = async (zipBlob?: Blob) => {
    if (zipBlob) {
      await restoreBackupWithRollback(zipBlob);
      return;
    }
    if (!canReset) return;
    await clearCurrentContent();
    createDefaultNotebook();
    await resetSettingsToDefaults();
    resetAuxiliaryAppState();
    setResetDialogOpen(false);
    onOpenChange(false);
    toast.success("重置成功");
  };

  const handleManualReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await handleReset();
    } catch (error) {
      console.error("Reset failed", error);
      toast.error("重置失败", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setResetting(false);
    }
  };

  const handleCloseAppsBanner = () => {
    dismissAppsBanner();
  };

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        layout="fullscreen"
        hideClose
        overlayClassName="bg-transparent backdrop-blur-0"
        contentClassName="border-0 bg-[hsl(var(--goose-shell-bg))]"
        bodyClassName="min-w-0 h-full animate-in fade-in duration-200"
      >
        <SettingsScaffold
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => onOpenChange(false)}
          tabs={SETTINGS_TABS}
          feedbackBanner={null}
          appsBanner={renderRecommendedAppsBanner({
            appsBannerVisible,
            handleCloseAppsBanner,
          })}
        >
          {activeTab === "general" && (
            <div className="space-y-4">
              <SettingsGeneral
                searchProviders={searchProviders}
                toggleSearchProvider={toggleSearchProvider}
                reorderSearchProviders={reorderSearchProviders}
                addCustomSearchProvider={addCustomSearchProvider}
                updateCustomSearchProvider={updateCustomSearchProvider}
                removeCustomSearchProvider={removeCustomSearchProvider}
                autoOpenLastNote={privacy.autoOpenLastNote}
                setAutoOpenLastNote={setAutoOpenLastNote}
                singleTabMode={effectiveSingleTabMode(singleTabMode)}
                setSingleTabMode={(enabled) => {
                  setSingleTabMode(enabled);
                  if (enabled) {
                    useTabs.getState().collapseToActiveTab();
                    toast.success("已开启极简工作区");
                  }
                }}
                showRecentInSearch={showRecentInSearch}
                setShowRecentInSearch={setShowRecentInSearch}
                notebookDropdownHoverExpand={notebookDropdownHoverExpand}
                setNotebookDropdownHoverExpand={setNotebookDropdownHoverExpand}
                customActions={customActions}
                addCustomAction={addCustomAction}
                updateCustomAction={updateCustomAction}
                removeCustomAction={removeCustomAction}
              />
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div>
              <SettingsShortcuts
                closeTabShortcut={closeTabShortcut}
                setCloseTabShortcut={setCloseTabShortcut}
                searchPanelCloseShortcut={searchPanelCloseShortcut}
                setSearchPanelCloseShortcut={setSearchPanelCloseShortcut}
                appShortcuts={appShortcuts}
                setAppShortcut={setAppShortcut}
                resetAppShortcuts={resetAppShortcuts}
                singleTabMode={effectiveSingleTabMode(singleTabMode)}
              />
            </div>
          )}

          {activeTab === "local-folder" && (
            <div>
              <SettingsLocalFolder
                localFolderFileManager={localFolderFileManager}
                setLocalFolderFileManager={setLocalFolderFileManager}
                localFolderExternalEditor={localFolderExternalEditor}
                setLocalFolderExternalEditor={setLocalFolderExternalEditor}
                localFolderTerminal={localFolderTerminal}
                setLocalFolderTerminal={setLocalFolderTerminal}
                localFolderHiddenFolders={localFolderHiddenFolders}
                setLocalFolderHiddenFolders={setLocalFolderHiddenFolders}
              />
            </div>
          )}

          {activeTab === "appearance" && (
            <div>
              <SettingsAppearance
                theme={theme}
                setTheme={setTheme}
                accentColor={accentColor}
                setAccentColor={setAccentColor}
                codeStyle={codeStyle}
                setCodeStyle={setCodeStyle}
                customFonts={customFonts}
                setCustomLabel={setCustomLabel}
                setCustomFont={setCustomFont}
                uiFontSize={uiFontSize}
                setUIFontSize={setUIFontSize}
                sidebarFontSize={sidebarFontSize}
                increaseSidebarFontSize={increaseSidebarFontSize}
                decreaseSidebarFontSize={decreaseSidebarFontSize}
                editorFontSize={editorFontSize}
                increaseEditorFontSize={increaseEditorFontSize}
                decreaseEditorFontSize={decreaseEditorFontSize}
                hideExpandArrows={hideExpandArrows}
                setHideExpandArrows={setHideExpandArrows}
                randomIconOnCreate={randomIconOnCreate}
                setRandomIconOnCreate={setRandomIconOnCreate}
              />
            </div>
          )}

          {activeTab === "ai" && (
            <div>
              <SettingsAI
                ai={ai}
                enabled={ai.enabled}
                setEnabled={setAIEnabled}
                setReadGlobalPrompt={setAIReadGlobalPrompt}
                setReadLocalSkills={setAIReadLocalSkills}
                selectedModelId={ai.selectedModelId}
                setSelectedModelId={setAISelectedModelId}
                saveCustomConfig={saveAICustomConfig}
              />
            </div>
          )}

          {activeTab === "data" && (
            <SettingsDataPanel
              importing={importing}
              onImport={handleImport}
              selectedIds={selectedIds}
              notebookList={notebookList}
              onToggleNotebook={toggleNotebook}
              onSelectAll={selectAll}
              format={format}
              onFormatChange={setFormat}
              exporting={exporting}
              onExport={handleExport}
              onOpenResetDialog={() => setResetDialogOpen(true)}
              onResetAndImport={handleReset}
            />
          )}
        </SettingsScaffold>
      </DialogShell>

      {renderResetConfirmation({
        resetDialogOpen,
        setResetDialogOpen,
        resetPhrase,
        resetInput,
        setResetInput,
        canReset,
        resetting,
        handleManualReset,
      })}
    </>
  );
}
