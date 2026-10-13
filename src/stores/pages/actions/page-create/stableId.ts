import { v4 as uuidv4 } from "uuid";
import { useNotebooks } from "../../../useNotebooks";
import {
  readLocalPageIdMap,
  resolveOrCreateStableId,
  toRelativePath,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";

export function generateLocalPageId(
  notebookId: string,
  filePath: string,
): string {
  const notebook = useNotebooks.getState().notebooks[notebookId];
  if (!notebook?.localPath) return uuidv4();
  const basePath = notebook.localPath;
  const relativePath = toRelativePath(basePath, filePath);
  const map = readLocalPageIdMap(notebookId);
  const { id, dirty } = resolveOrCreateStableId(notebookId, relativePath, map);
  if (dirty) {
    writeLocalPageIdMap(notebookId, map);
  }
  return id;
}
