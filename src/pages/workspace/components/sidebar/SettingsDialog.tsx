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
import { SettingsDataPanel } from "./settings/SettingsDataPanel";
import { SettingsAI } from "./SettingsAI";
import { SettingsScaffold } from "./settings/SettingsScaffold";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import type { SettingsTab } from "./settings/types";
import {
  isTelemetryEnabled,
  setTelemetryEnabled,
  subscribeTelemetry,
  telemetryPreview,
} from "@/lib/telemetry";
import { useShallow } from "zustand/react/shallow";
import { useNotebooks, sortNotebooksByOrder } from "@/stores/useNotebooks";
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
  /** 懒加载首挂时要显示的页签（挂载前派发的 settings-tab-change 事件收不到）。 */
  initialTab?: SettingsTab;
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialTab,
}: SettingsDialogProps) {
  useEffect(() => {
    document.body.toggleAttribute("data-goose-settings-open", open);

    return () => {
      document.body.removeAttribute("data-goose-settings-open");
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
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab ?? "general",
  );

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
  const [telemetryEnabled, setTelemetryEnabledState] = useState(() =>
    isTelemetryEnabled(),
  );
  const [telemetryPreviewOpen, setTelemetryPreviewOpen] = useState(false);
  const [telemetrySnapshot, setTelemetrySnapshot] = useState(() =>
    telemetryPreview(),
  );

  useEffect(() => {
    const syncTelemetry = () => {
      setTelemetryEnabledState(isTelemetryEnabled());
      setTelemetrySnapshot(telemetryPreview());
    };
    syncTelemetry();
    return subscribeTelemetry(syncTelemetry);
  }, [open, telemetryPreviewOpen]);
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
        overlayClassName="bg-transparent backdrop-blur-none"
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

              <SettingsSectionCard
                title="隐私与统计"
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-[10px]"
                    onClick={() => {
                      setTelemetrySnapshot(telemetryPreview());
                      setTelemetryPreviewOpen(true);
                    }}
                  >
                    查看上报内容
                  </Button>
                }
              >
                <div className="flex items-center justify-between gap-4 rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] p-4 dark:bg-[hsl(var(--foreground)/0.08)]">
                  <div>
                    <div className="flex items-center gap-3">
                      <LucideIcons.BarChart2
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                      <Label
                        htmlFor="telemetry-enabled"
                        className="cursor-pointer"
                      >
                        发送匿名使用统计
                      </Label>
                    </div>
                    <p className="mt-1 pl-7 text-xs text-muted-foreground">
                      只统计功能使用次数和报错类型，不含任何笔记内容，关闭后会删除匿名编号。
                    </p>
                  </div>
                  <Switch
                    id="telemetry-enabled"
                    checked={telemetryEnabled}
                    onCheckedChange={(checked) => {
                      setTelemetryEnabled(checked);
                    }}
                    className="data-[state=unchecked]:bg-[hsl(var(--foreground)/0.12)]"
                  />
                </div>
              </SettingsSectionCard>
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

      <DialogShell
        open={telemetryPreviewOpen}
        onOpenChange={setTelemetryPreviewOpen}
        title="上报内容预览"
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          <pre
            data-testid="telemetry-preview-json"
            className="max-h-[60vh] overflow-auto rounded-[12px] border border-border/70 bg-[hsl(var(--goose-selected-bg)/0.45)] p-3 font-mono text-xs leading-relaxed text-foreground/90 select-text dark:bg-[hsl(var(--foreground)/0.06)]"
          >
            {JSON.stringify(telemetrySnapshot, null, 2)}
          </pre>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-[10px]"
              onClick={() => setTelemetryPreviewOpen(false)}
            >
              关闭
            </Button>
          </div>
        </div>
      </DialogShell>
    </>
  );
}
