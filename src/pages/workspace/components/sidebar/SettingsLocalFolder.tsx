import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import {
  isElectronHost,
  type SettingsLocalFolderProps,
  SETTINGS_OPTION_ROW_CLASS,
} from "./settings-local-folder/definitions";
import { OpenAppField } from "./settings-local-folder/OpenAppField";
import { HiddenFoldersField } from "./settings-local-folder/HiddenFoldersField";
import { LocalAssetMaintenanceDialog } from "./settings-local-folder/LocalAssetMaintenanceDialog";
import { LegacyInternalPagesExportCard } from "./settings-local-folder/LegacyInternalPagesExportCard";
import {
  useLocalFolderOpenAppOptions,
  useLocalFolderOpenAppDetection,
} from "./settings-local-folder/useLocalFolderOpenApps";
import { useLocalFolderAssetMaintenance } from "./settings-local-folder/useLocalFolderAssetMaintenance";
import { useLocalFolderHiddenFolders } from "./settings-local-folder/useLocalFolderHiddenFolders";

export function SettingsLocalFolder({
  localFolderFileManager,
  setLocalFolderFileManager,
  localFolderExternalEditor,
  setLocalFolderExternalEditor,
  localFolderTerminal,
  setLocalFolderTerminal,
  localFolderHiddenFolders,
  setLocalFolderHiddenFolders,
}: SettingsLocalFolderProps) {
  const {
    fileManagerOptions,
    setFileManagerOptions,
    editorOptions,
    setEditorOptions,
    terminalOptions,
    setTerminalOptions,
    systemDefaultLabels,
  } = useLocalFolderOpenAppOptions();
  const hiddenFoldersRefreshNonceRef = useRef(0);

  const {
    maintenanceOpen,
    setMaintenanceOpen,
    maintenanceLoading,
    unreferencedAssets,
    scanUnreferencedAssets,
    deleteUnreferencedAssets,
  } = useLocalFolderAssetMaintenance();

  const { handleHiddenFoldersChange } = useLocalFolderHiddenFolders({
    setLocalFolderHiddenFolders,
    hiddenFoldersRefreshNonceRef,
  });

  useLocalFolderOpenAppDetection({
    setFileManagerOptions,
    setEditorOptions,
    setTerminalOptions,
  });

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        本地文件夹
      </h3>

      {isElectronHost && <LegacyInternalPagesExportCard />}

      <SettingsSectionCard title="打开方式">
        <div className="space-y-3">
          <OpenAppField
            id="local-folder-file-manager"
            title="文件管理器"
            description="右键打开或显示本地文件时使用。"
            icon={LucideIcons.FolderOpen}
            value={localFolderFileManager}
            onChange={setLocalFolderFileManager}
            defaultLabel={systemDefaultLabels.fileManager}
            customPlaceholder="如：Path Finder"
            options={fileManagerOptions}
          />
          <OpenAppField
            id="local-folder-editor"
            title="编辑器"
            description="右键用外部应用打开文件或文件夹时使用。"
            icon={LucideIcons.SquarePen}
            value={localFolderExternalEditor}
            onChange={setLocalFolderExternalEditor}
            defaultLabel="系统默认"
            customPlaceholder="如：Cursor、Zed、code -r"
            options={editorOptions}
          />
          <OpenAppField
            id="local-folder-terminal"
            title="终端"
            description="右键在终端中打开目录时使用。"
            icon={LucideIcons.Terminal}
            value={localFolderTerminal}
            onChange={setLocalFolderTerminal}
            defaultLabel={systemDefaultLabels.terminal}
            customPlaceholder="如：Ghostty、iTerm、wezterm"
            options={terminalOptions}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="显示">
        <HiddenFoldersField
          folders={localFolderHiddenFolders}
          onChange={handleHiddenFoldersChange}
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="存储维护">
        <div
          className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <div>
            <div className="flex items-center gap-3">
              <LucideIcons.Trash2
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label>清理未引用静态资源</Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              扫描页面同级 assets 目录及根 assets 兼容目录。会读取全部
              Markdown（含隐藏目录中的笔记），避免把仍在使用的图片标成未引用。
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={() => void scanUnreferencedAssets()}
          >
            扫描资源
          </Button>
        </div>
      </SettingsSectionCard>

      <LocalAssetMaintenanceDialog
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
        assets={unreferencedAssets}
        loading={maintenanceLoading}
        onDelete={deleteUnreferencedAssets}
      />
    </div>
  );
}
