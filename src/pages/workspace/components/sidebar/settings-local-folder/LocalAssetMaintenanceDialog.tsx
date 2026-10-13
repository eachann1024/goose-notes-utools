import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { shell } from "@/lib/utools/shell";
import { fs } from "@/lib/utools/fs";
import { type UnreferencedLocalAsset } from "@/lib/local-folder-asset-maintenance";
import { DialogShell } from "@/components/ui/dialog-shell";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  getLocalAssetKind,
  localAssetKindLabel,
  LocalAssetKindIcon,
  assetDirectoryLabel,
} from "./assetPresentation";

export interface LocalAssetMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: UnreferencedLocalAsset[];
  loading: boolean;
  onDelete: (paths: string[]) => Promise<void>;
}

export function LocalAssetMaintenanceDialog({
  open,
  onOpenChange,
  assets,
  loading,
  onDelete,
}: LocalAssetMaintenanceDialogProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedPaths([]);
      setConfirming(false);
      setDeleting(false);
      return;
    }
    setSelectedPaths([]);
    setConfirming(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const assetPaths = new Set(assets.map((asset) => asset.path));
    setSelectedPaths((current) =>
      current.filter((path) => assetPaths.has(path)),
    );
  }, [assets, open]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedPaths.includes(asset.path)),
    [assets, selectedPaths],
  );
  const totalSize = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.size, 0),
    [assets],
  );
  const selectedSize = useMemo(
    () => selectedAssets.reduce((sum, asset) => sum + asset.size, 0),
    [selectedAssets],
  );
  const allSelected =
    assets.length > 0 && selectedPaths.length === assets.length;
  const releaseSize = selectedPaths.length > 0 ? selectedSize : totalSize;

  const toggle = (path: string) => {
    setConfirming(false);
    setSelectedPaths((current) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path],
    );
  };

  const toggleAll = () => {
    setConfirming(false);
    setSelectedPaths(allSelected ? [] : assets.map((asset) => asset.path));
  };

  const deleteSelected = async () => {
    if (selectedPaths.length === 0) return;
    setDeleting(true);
    try {
      await onDelete(selectedPaths);
      setSelectedPaths([]);
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  const revealAsset = (asset: UnreferencedLocalAsset) => {
    void shell
      .showItemInFolder(asset.path)
      .then((shown) => shown || fs.revealItemInFolder(asset.path));
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="清理未引用静态资源"
      description="将移入系统废纸篓，可从废纸篓找回。"
      contentClassName="grid h-[min(80vh,52rem)] w-[min(96vw,56rem)] max-w-[56rem] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden !p-0 sm:rounded-[18px]"
      bodyClassName="flex min-h-0 flex-col overflow-hidden px-0 py-0"
      footer={
        confirming ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm text-[var(--goose-color-danger-focus)]">
              将把 {selectedPaths.length} 个文件移入系统废纸篓，释放{" "}
              {formatFileSize(selectedSize)}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                返回
              </Button>
              <Button
                variant="destructive"
                className="min-w-[8rem]"
                onClick={() => void deleteSelected()}
                disabled={deleting || selectedPaths.length === 0}
              >
                {deleting ? "删除中…" : "确认删除"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            <Button
              variant="destructive"
              className="min-w-[8rem]"
              disabled={selectedPaths.length === 0}
              onClick={() => setConfirming(true)}
            >
              {selectedPaths.length > 0
                ? `删除已选 · ${formatFileSize(selectedSize)}`
                : "删除已选"}
            </Button>
          </div>
        )
      }
    >
      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-sm text-muted-foreground">
          <LucideIcons.LoaderCircle className="h-5 w-5 animate-spin text-foreground" />
          <div>正在扫描资源…</div>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-sm text-muted-foreground">
          <LucideIcons.CheckCircle2 className="h-5 w-5 text-[var(--goose-color-success)]" />
          <div>没有可清理资源</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-2 pt-1">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div className="min-w-0 text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {assets.length}
              </span>{" "}
              个未引用文件 · 可释放{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatFileSize(releaseSize)}
              </span>
              {selectedPaths.length > 0 ? (
                <span> · 已选 {selectedPaths.length}</span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0"
              onClick={toggleAll}
            >
              {allSelected ? "取消全选" : "全选"}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-[14px] border border-[var(--goose-block-subtle-border)] bg-background">
            <div className="h-full max-h-none overflow-y-auto">
              {assets.map((asset, index) => {
                const selected = selectedPaths.includes(asset.path);
                const kind = getLocalAssetKind(asset.name);
                const directory = assetDirectoryLabel(asset.relativePath);
                return (
                  <div
                    key={asset.path}
                    className={cn(
                      "group grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 transition-colors",
                      index > 0 &&
                        "border-t border-[var(--goose-block-subtle-border)]",
                      selected
                        ? "bg-[var(--goose-interactive-selected)]"
                        : "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
                    )}
                  >
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]"
                      aria-pressed={selected}
                      aria-label={
                        selected
                          ? `取消选择 ${asset.name}`
                          : `选择 ${asset.name}`
                      }
                      onClick={() => toggle(asset.path)}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-[5px] border",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background",
                        )}
                      >
                        {selected ? (
                          <LucideIcons.Check
                            className="h-3 w-3"
                            strokeWidth={3}
                          />
                        ) : null}
                      </span>
                    </button>

                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-[10px]",
                        selected
                          ? "bg-[var(--goose-icon-chip-on-selected)] text-[var(--goose-interactive-selected-fg)]"
                          : "bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
                      )}
                    >
                      <LocalAssetKindIcon kind={kind} />
                    </div>

                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => toggle(asset.path)}
                    >
                      <div className="truncate text-sm font-medium text-foreground">
                        {asset.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {localAssetKindLabel(kind)} · {directory}
                      </div>
                    </button>

                    <div className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {formatFileSize(asset.size)}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-[10px] text-muted-foreground hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]"
                      aria-label={`在文件管理器显示 ${asset.name}`}
                      onClick={() => revealAsset(asset)}
                    >
                      <LucideIcons.FolderSearch className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </DialogShell>
  );
}
