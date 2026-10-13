import { useCallback, useEffect } from "react";
import { getBlockNoteSlashMenuItems, filterSlashMenuItems, warmupSlashMenuIcons } from "./blocknoteSlashItems";
import type { RefObject } from "react";
import type { EditorSettings, EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorInstance } from "./editorTypes";

export function useEditorSlashMenu({
  editor,
  aiSettingsRef,
  contentModeRef,
  settingsRef,
  hiddenSlashItemTitles,
}: {
  editor: EditorInstance;
  aiSettingsRef: RefObject<EditorSettings["ai"]>;
  contentModeRef: RefObject<EditorPageContext["contentMode"]>;
  settingsRef: RefObject<EditorSettings>;
  hiddenSlashItemTitles: string[] | undefined;
}) {
  const getSlashItems = useCallback(
    async (query: string) => {
      let items = getBlockNoteSlashMenuItems(
        editor,
        aiSettingsRef.current.enabled &&
          (contentModeRef.current === "normalized" || __HOST_TARGET__ === "native-editor"),
        settingsRef.current.features,
      );
      if (hiddenSlashItemTitles && hiddenSlashItemTitles.length > 0) {
        const hidden = new Set(hiddenSlashItemTitles);
        const isDivider = (it: (typeof items)[number]) => (it as { type?: string }).type === "divider";
        const kept = items.filter((item) => !hidden.has(item.title));
        // 砍项后清理冗余分隔线：折叠连续/首部 divider，再去尾部 divider。
        const collapsed: typeof items = [];
        for (const it of kept) {
          if (isDivider(it) && (collapsed.length === 0 || isDivider(collapsed[collapsed.length - 1]))) {
            continue;
          }
          collapsed.push(it);
        }
        while (collapsed.length > 0 && isDivider(collapsed[collapsed.length - 1])) {
          collapsed.pop();
        }
        items = collapsed;
      }
      return filterSlashMenuItems(items, query);
    },
    [editor, hiddenSlashItemTitles],
  );
  return { getSlashItems };
}

export function useSlashMenuWarmup() {
  useEffect(() => {
    const warm = () => {
      warmupSlashMenuIcons();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);
}
