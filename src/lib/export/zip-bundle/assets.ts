import type JSZipNs from "jszip";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import {
  isLocalFilePath,
  resolveToAbsolute,
  readLocalFileAsBase64,
} from "@/lib/imageStorage/strategies/file-system";
import { extensionFromMimeType, getRelativeAssetPath, guessAssetExtFromPath } from "./paths";

let imageStoragePromise: Promise<{
  imageStorage: { load: (ref: string) => Promise<Blob | null> };
}> | null = null;

const getImageStorage = async () => {
  if (!imageStoragePromise) {
    imageStoragePromise = import("@/lib/imageStorage");
  }
  return imageStoragePromise;
};

function parseBase64Asset(
  src: string,
): { data: string; mimeType: string; extension: string } | null {
  const match = src.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const subtype = mimeType.split("/")[1] || "bin";
  return {
    mimeType,
    extension: extensionFromMimeType(mimeType, subtype),
    data: match[2],
  };
}

const EXPORTABLE_ASSET_BLOCK_TYPES = new Set([
  "image",
  "imageResize",
  "file",
  "audio",
  "video",
]);

/**
 * 将图片路径解析为绝对路径后，通过 Node.js fs 读取为 base64
 * 优先基于页面文件目录解析（相对路径语义正确），兜底用笔记本根目录
 */
function resolveAndReadBase64(
  notebookPath: string | undefined,
  src: string,
  pageFilePath?: string,
): { data: string; resolvedPath: string } | null {
  // 绝对路径直接读取
  if (src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)) {
    const data = readLocalFileAsBase64(src);
    return data ? { data, resolvedPath: src } : null;
  }

  // 优先相对于页面文件目录解析
  if (pageFilePath) {
    const pageDir = pageFilePath.replace(/[\\/][^\\/]+$/, "");
    const fullPath = resolveToAbsolute(pageDir, src);
    const result = readLocalFileAsBase64(fullPath);
    if (result) return { data: result, resolvedPath: fullPath };
  }

  // 兜底：相对于笔记本根目录
  if (notebookPath) {
    const fullPath = resolveToAbsolute(notebookPath, src);
    const data = readLocalFileAsBase64(fullPath);
    return data ? { data, resolvedPath: fullPath } : null;
  }

  return null;
}

/** 把页面块里的本地图/文件/音视频抽进 ZIP assets/，并把 url 改成相对路径。单页 ZIP 复用。 */
export async function extractImagesFromContent(
  content: any[],
  assetsFolder: JSZipNs,
  imageMap: Map<string, string>,
  usedAssetNames: Set<string>,
  depth: number,
  notebookPath?: string,
  pageFilePath?: string,
) {
  const fallbackBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NkYGD4DwABBAEAf6S4JwAAAABJRU5ErkJggg==";

  for (const block of content) {
    if (!block || typeof block !== "object") continue;

    if (EXPORTABLE_ASSET_BLOCK_TYPES.has(block.type) && block.props?.url) {
      const src = block.props.url;
      let finalSrc = src;
      const isImage = block.type === "image" || block.type === "imageResize";
      const isLocalAsset = isLocalFilePath(src);

      if (!isLocalAsset && imageMap.has(src)) {
        block.props.url = getRelativeAssetPath(imageMap.get(src)!, depth);
        continue;
      }

      // 1) 内部存储引用（uuid: / att:）→ 加载为 blob → base64
      if (isImage && (src.startsWith("uuid:") || src.startsWith("att:"))) {
        const { imageStorage } = await getImageStorage();
        const blob = await imageStorage.load(src);
        if (blob) {
          finalSrc = await blobToBase64(blob);
        } else {
          finalSrc = fallbackBase64;
        }
      }
      if (!isImage && src.startsWith("att-file:")) {
        const { fileStorage } = await import("@/lib/fileStorage");
        const blob = await fileStorage.load(src);
        if (blob) {
          finalSrc = await blobToBase64(blob);
        }
      }
      if (block.type === "video" && src.startsWith("att-video:")) {
        const { videoStorage } = await import("@/lib/videoStorage");
        const blob = await videoStorage.load(src, pageFilePath);
        if (blob) {
          finalSrc = await blobToBase64(blob);
        }
      }

      // 2) 本地文件路径（相对/绝对）→ 从文件系统读取
      if (isLocalAsset) {
        const loadedAsset = resolveAndReadBase64(
          notebookPath,
          src,
          pageFilePath,
        );
        if (loadedAsset) {
          const imageMapKey = `local:${loadedAsset.resolvedPath}`;
          if (imageMap.has(imageMapKey)) {
            block.props.url = getRelativeAssetPath(
              imageMap.get(imageMapKey)!,
              depth,
            );
            continue;
          }
          const ext = guessAssetExtFromPath(src, isImage ? "png" : "bin");
          // 用原始文件名，避免重名加随机后缀
          const rawName =
            src.split(/[\\/]/).pop() || `img_${Date.now()}.${ext}`;
          const uniqueName = usedAssetNames.has(rawName)
            ? `${rawName.replace(/\.([^.]+)$/, "")}_${Math.random().toString(36).slice(2, 6)}.${ext}`
            : rawName;
          assetsFolder.file(uniqueName, loadedAsset.data, { base64: true });
          imageMap.set(imageMapKey, uniqueName);
          usedAssetNames.add(uniqueName);
          block.props.url = getRelativeAssetPath(uniqueName, depth);
        }
        continue;
      }

      // 3) 去重：同一个 base64 源只存一次
      if (imageMap.has(finalSrc)) {
        block.props.url = getRelativeAssetPath(imageMap.get(finalSrc)!, depth);
        continue;
      }

      // 4) base64 内联图 → 解析并存入 assets
      if (finalSrc.startsWith("data:")) {
        const parsed = parseBase64Asset(finalSrc);
        if (parsed) {
          const fallbackPrefix = isImage ? "img" : "file";
          const rawName =
            !isImage && typeof block.props?.name === "string"
              ? block.props.name
              : "";
          const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(rawName);
          const candidate = rawName
            ? hasExt
              ? rawName
              : `${rawName}.${parsed.extension}`
            : `${fallbackPrefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}.${parsed.extension}`;
          const filename = usedAssetNames.has(candidate)
            ? `${candidate.replace(/\.([^.]+)$/, "")}_${Math.random().toString(36).slice(2, 6)}.${parsed.extension}`
            : candidate;
          assetsFolder.file(filename, parsed.data, { base64: true });

          imageMap.set(finalSrc, filename);
          if (src !== finalSrc) {
            imageMap.set(src, filename);
          }
          usedAssetNames.add(filename);
          block.props.url = getRelativeAssetPath(filename, depth);
        }
      }
    }

    if (block.children?.length) {
      await extractImagesFromContent(
        block.children,
        assetsFolder,
        imageMap,
        usedAssetNames,
        depth,
        notebookPath,
        pageFilePath,
      );
    }
  }
}
