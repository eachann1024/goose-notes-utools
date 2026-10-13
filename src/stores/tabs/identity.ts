import type { TabItem } from "./types";

export const WELCOME_TAB_PAGE_ID = "welcome";

export const NOTEBOOK_AI_TAB_PAGE_ID_PREFIX = "notebook-ai:";

export function getNotebookAiTabPageId(notebookId: string): string {
  return `${NOTEBOOK_AI_TAB_PAGE_ID_PREFIX}${notebookId}`;
}

export function isNotebookAiTab(
  tab: Pick<TabItem, "type"> | null | undefined,
): boolean {
  return tab?.type === "notebook-ai";
}

export function isSpecialTab(
  tab: Pick<TabItem, "type"> | null | undefined,
): boolean {
  return tab?.type === "welcome" || tab?.type === "notebook-ai";
}
