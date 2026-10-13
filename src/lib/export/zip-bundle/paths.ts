export function extensionFromMimeType(mimeType: string, fallback = "bin"): string {
  const normalized = mimeType.toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "text/plain": "txt",
    "text/markdown": "md",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "video/mp4": "mp4",
  };
  const sanitizedFallback = fallback
    .replace(/^x-/, "")
    .replace(/[^a-z0-9]+/g, "");
  return map[normalized] ?? (sanitizedFallback || "bin");
}

export function mimeTypeFromAssetPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    zip: "application/zip",
    txt: "text/plain",
    md: "text/markdown",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
  };
  return map[ext] ?? "application/octet-stream";
}

export function getRelativeAssetPath(filename: string, depth: number): string {
  // depth 0 = 笔记本根目录，assets 在同级 → ./assets/
  // depth 1 = 子文件夹内页面 → ../assets/
  const prefix = depth > 0 ? "../".repeat(depth) : "./";
  return `${prefix}assets/${filename}`;
}

export function getBundledAssetName(src: string): string | null {
  const normalized = src.replace(/\\/g, "/");
  const match = normalized.match(
    /^(?:\.\/|(?:\.\.\/)+)?assets\/([^?#]+)(?:[?#].*)?$/,
  );
  return match?.[1] ?? null;
}

export function guessAssetExtFromPath(filePath: string, fallback = "bin"): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{1,8}$/.test(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return fallback;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}
