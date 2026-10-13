import { useMemo } from "react";
import { createInlineCodePathTagExtension } from "@/components/editor/extensions/inlineCodePathTagExtension";
import { createPageMentionClickExtension } from "@/components/editor/extensions/pageMentionClickExtension";
import { toast } from "@/components/ui/sonner";
import type { RefObject } from "react";
import type { EditorPageContext } from "@/components/editor/platform/hostContext";
import type { EditorPlatform } from "@/components/editor/platform/types";

export function useEditorExtensions({
  getActivePageLocalFilePathRef,
  getActivePageLocalFolderRootRef,
  platformRef,
  onOpenAttachmentRef,
  onOpenPageRef,
}: {
  getActivePageLocalFilePathRef: RefObject<EditorPageContext["getActivePageLocalFilePath"]>;
  getActivePageLocalFolderRootRef: RefObject<EditorPageContext["getActivePageLocalFolderRoot"]>;
  platformRef: RefObject<EditorPlatform>;
  onOpenAttachmentRef: RefObject<EditorPageContext["onOpenAttachment"]>;
  onOpenPageRef: RefObject<EditorPageContext["onOpenPage"]>;
}) {
  // 行内代码相对路径 tag：扩展实例只建一次（extensions 数组变化会重建编辑器），
  // 依赖全部走 ref 读取。放在 inlineCodeCaret 之前，Cmd/Ctrl 点击先被它短路。
  const inlineCodePathTagExtension = useMemo(
    () =>
      createInlineCodePathTagExtension({
        getPageLocalFilePath: () => getActivePageLocalFilePathRef.current(),
        getLocalFolderRoot: () => getActivePageLocalFolderRootRef.current(),
        existsAsync: (path) => platformRef.current.fs.existsAsync(path),
        isFsAvailable: () => platformRef.current.fs.isAvailable(),
        openPath: (rawText) => {
          const open = onOpenAttachmentRef.current;
          if (!open) return;
          const fileName = rawText.split(/[\\/]/).pop() || rawText;
          void open(rawText, fileName).then((result) => {
            if (!result.ok) {
              toast.error("无法打开该路径", {
                description: result.error,
              });
            }
          });
        },
      }),
    [],
  );

  const pageMentionClickExtension = useMemo(
    () =>
      createPageMentionClickExtension({
        openPage: (pageId, wikiTarget, options) => onOpenPageRef.current(pageId, wikiTarget, options),
      }),
    [],
  );
  return { inlineCodePathTagExtension, pageMentionClickExtension };
}
