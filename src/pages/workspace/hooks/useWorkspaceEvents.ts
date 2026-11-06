import { useEffect, useRef } from "react";

interface UseWorkspaceEventsOptions {
  activePageId: string | null | undefined;
  page: unknown;
}

export function useWorkspaceEvents({
  activePageId,
  page,
}: UseWorkspaceEventsOptions) {
  const lastViewedPageIdRef = useRef<string | null>(null);

  // Close AI page when switching pages (kept for future NotebookAiPanel hookup)
  useEffect(() => {
    if (!activePageId || !page) {
      lastViewedPageIdRef.current = null;
      return;
    }
    lastViewedPageIdRef.current = activePageId;
  }, [activePageId, page]);
}
