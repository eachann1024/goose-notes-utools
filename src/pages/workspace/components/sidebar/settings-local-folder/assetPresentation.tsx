import * as LucideIcons from "lucide-react";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

export type LocalAssetKind = "image" | "video" | "audio" | "file";

export function getLocalAssetKind(name: string): LocalAssetKind {
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
      "bmp",
      "avif",
      "heic",
      "ico",
    ].includes(ext)
  ) {
    return "image";
  }
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "flac", "m4a", "ogg"].includes(ext)) return "audio";
  return "file";
}

export function localAssetKindLabel(kind: LocalAssetKind): string {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  if (kind === "audio") return "音频";
  return "文件";
}

export function LocalAssetKindIcon({ kind }: { kind: LocalAssetKind }) {
  const className = "h-4 w-4";
  if (kind === "image") return <LucideIcons.Image className={className} />;
  if (kind === "video") return <LucideIcons.Film className={className} />;
  if (kind === "audio") return <LucideIcons.Music className={className} />;
  return <LucideIcons.File className={className} />;
}

export function assetDirectoryLabel(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}
