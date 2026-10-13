import { useState } from "react";
import { fs } from "@/lib/utools/fs";
import {
  scanUnreferencedLocalAssets,
  restoreMissingReferencedLocalAssets,
  type UnreferencedLocalAsset,
} from "@/lib/local-folder-asset-maintenance";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { toast } from "@/components/ui/sonner";

export function useLocalFolderAssetMaintenance() {
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [unreferencedAssets, setUnreferencedAssets] = useState<
    UnreferencedLocalAsset[]
  >([]);

  const scanUnreferencedAssets = async () => {
    const notebookState = useNotebooks.getState();
    const activeNotebook = notebookState.activeNotebookId
      ? notebookState.notebooks[notebookState.activeNotebookId]
      : null;
    if (
      activeNotebook?.source !== "local-folder" ||
      !activeNotebook.localPath ||
      !window.gooseFs
    ) {
      toast.warning("请先切换到本地文件夹记事本");
      return;
    }

    setMaintenanceOpen(true);
    setMaintenanceLoading(true);
    try {
      window.dispatchEvent(
        new CustomEvent("goose-note:flush-editor", {
          detail: { immediate: true },
        }),
      );
      await usePages.getState().flushPendingLocalSaves();
      const pages = Object.values(usePages.getState().pages).filter(
        (page) => page.workspaceId === activeNotebook.id,
      );
      const scanOptions = {
        basePath: activeNotebook.localPath,
        pages,
        gooseFs: window.gooseFs,
      };
      const recovered = await restoreMissingReferencedLocalAssets(scanOptions);
      if (recovered.restored.length > 0) {
        toast.success(
          `已从废纸篓找回 ${recovered.restored.length} 个仍被引用的文件`,
        );
      }
      if (recovered.missing.length > 0) {
        toast.warning(
          `仍有 ${recovered.missing.length} 个被引用文件缺失，请到系统废纸篓手动找回`,
        );
      }
      setUnreferencedAssets(await scanUnreferencedLocalAssets(scanOptions));
    } catch (error) {
      console.error("[settings] 扫描未引用静态资源失败", error);
      toast.error("扫描未引用静态资源失败");
      setMaintenanceOpen(false);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const deleteUnreferencedAssets = async (paths: string[]) => {
    const results = await Promise.all(paths.map((path) => fs.deleteFile(path)));
    const deletedPaths = new Set(paths.filter((_, index) => results[index]));
    setUnreferencedAssets((assets) =>
      assets.filter((asset) => !deletedPaths.has(asset.path)),
    );
    if (deletedPaths.size)
      toast.success(`已删除 ${deletedPaths.size} 个未引用文件`);
    if (deletedPaths.size !== paths.length) toast.error("部分文件删除失败");
  };

  return {
    maintenanceOpen,
    setMaintenanceOpen,
    maintenanceLoading,
    unreferencedAssets,
    scanUnreferencedAssets,
    deleteUnreferencedAssets,
  };
}
