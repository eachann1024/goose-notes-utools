import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { toast } from "@/components/ui/sonner";
import type { ExportOptions } from "@/lib/export";

const recordPreOverwriteHistory = async (id: string | undefined) => {
  if (!id) return;
  const existingPage = usePages.getState().pages[id];
  if (existingPage && existingPage.content) {
    const oldContent = existingPage.content;
    const oldWorkspaceId = existingPage.workspaceId;
    try {
      const { recordHistorySnapshot } = await import("@/lib/history/snapshot");
      await recordHistorySnapshot({
        pageId: id,
        workspaceId: oldWorkspaceId,
        content: oldContent,
        trigger: "manual",
        isMilestone: true,
        label: "备份覆盖前本地版本",
      });
    } catch (err) {
      console.error("[history] Failed to save pre-overwrite history", err);
    }
  }
};

interface SettingsDataTransferOptions {
  selectedIds: string[];
  format: ExportOptions["format"];
  createNotebook: ReturnType<typeof useNotebooks.getState>["createNotebook"];
  setExporting: (value: boolean) => void;
  setImporting: (value: boolean) => void;
}

export function createSettingsDataTransferActions({
  selectedIds,
  format,
  createNotebook,
  setExporting,
  setImporting,
}: SettingsDataTransferOptions) {
  const handleExport = async () => {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      const { exportNotebooks } = await import("@/lib/export");
      // 导出当下再读库，设置对话框不订阅 pages。
      const notebooks = useNotebooks.getState().notebooks;
      const pages = usePages.getState().pages;
      await exportNotebooks(
        {
          format,
          notebookIds: selectedIds,
        },
        notebooks,
        Object.values(pages),
      );
      toast.success("导出成功");
    } catch (err) {
      console.error("Export failed", err);
      toast.error("导出失败", {
        description: err instanceof Error ? err.message : "请稍后重试。",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.mdzip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        let firstWorkspaceId: string | null = null;
        let firstPageId: string | null = null;
        let notebookCount = 0;
        let pageCount = 0;

        const { importNotebooksFromZip } = await import("@/lib/export");
        await importNotebooksFromZip(
          file,
          (name, icon, id) => {
            notebookCount++;
            const newId = createNotebook(name, icon || "BookOpen", true, id);
            if (!firstWorkspaceId) firstWorkspaceId = newId;
            return newId;
          },
          async (data, workspaceId, parentId, id) => {
            pageCount++;
            await recordPreOverwriteHistory(id);
            const pageId = usePages.getState().createPageRecord({
              ...data,
              id,
              workspaceId,
              parentId,
            });
            if (!firstPageId) firstPageId = pageId;
            return pageId;
          },
        );

        const { setActiveNotebook } = useNotebooks.getState();
        const { setActivePage } = usePages.getState();

        if (firstWorkspaceId) setActiveNotebook(firstWorkspaceId);
        if (firstPageId) {
          closeNotebookAiIfFullscreen();
          setActivePage(firstPageId);
        }

        toast.success("导入成功", {
          description: `已恢复 ${notebookCount} 个记事本，共 ${pageCount} 个页面`,
        });
      } catch (err) {
        console.error("Import failed", err);
        toast.error("导入失败", {
          description: "请确保文件是有效的导出 ZIP 包",
        });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  return { handleExport, handleImport };
}
