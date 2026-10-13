import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { toast } from "@/components/ui/sonner";
import { clearCurrentContent, createRollbackBackup } from "./contentReset";
import { createDefaultNotebook } from "./resetDefaults";

export function createSettingsBackupRestoreActions(
  createNotebook: ReturnType<typeof useNotebooks.getState>["createNotebook"],
) {
  const importBackupIntoEmptyState = async (blob: Blob) => {
    let firstWorkspaceId: string | null = null;
    let firstPageId: string | null = null;
    const { importNotebooksFromZip } = await import("@/lib/export");
    await importNotebooksFromZip(
      blob,
      (name, icon, id) => {
        const newId = createNotebook(name, icon || "BookOpen", true, id);
        if (!firstWorkspaceId) firstWorkspaceId = newId;
        return newId;
      },
      (data, workspaceId, parentId, id) => {
        const pageId = usePages.getState().createPageRecord({
          ...data,
          id,
          workspaceId,
          parentId,
        });
        if (!firstPageId && workspaceId === firstWorkspaceId)
          firstPageId = pageId;
        return pageId;
      },
    );
    if (!firstWorkspaceId) {
      throw new Error("备份中没有可恢复的记事本");
    }
    useNotebooks.setState({ activeNotebookId: firstWorkspaceId });
    closeNotebookAiIfFullscreen();
    usePages.setState({ activePageId: firstPageId });
  };

  const restoreBackupWithRollback = async (zipBlob: Blob) => {
    const { inspectNotebookImportZip } = await import("@/lib/export");
    await inspectNotebookImportZip(zipBlob);
    const rollbackBlob = await createRollbackBackup();

    await clearCurrentContent({
      preserveLocalFolders: true,
      preserveWorkspaceState: true,
    });
    try {
      await importBackupIntoEmptyState(zipBlob);
      useTabs.getState().reconcileTabs();
    } catch (error) {
      console.error("[restore] 导入失败，开始回滚", error);
      try {
        await clearCurrentContent({
          preserveLocalFolders: true,
          preserveWorkspaceState: true,
        });
        if (rollbackBlob) {
          await importBackupIntoEmptyState(rollbackBlob);
        } else {
          createDefaultNotebook();
        }
        useTabs.getState().reconcileTabs();
      } catch (rollbackError) {
        console.error("[restore] 回滚失败", rollbackError);
        throw new Error("恢复失败，且自动回滚未完成，请从本地导出备份恢复", {
          cause: rollbackError,
        });
      }
      throw new Error("恢复失败，已自动恢复覆盖前的数据", { cause: error });
    }
    toast.success("恢复并同步成功");
  };

  return { importBackupIntoEmptyState, restoreBackupWithRollback };
}
