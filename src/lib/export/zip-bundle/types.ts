export interface ExportOptions {
  format: "md" | "html";
  notebookIds: string[];
}

export interface NotebookImportInspection {
  source: "metadata" | "folders";
  notebookCount: number;
  pageCount: number;
}
