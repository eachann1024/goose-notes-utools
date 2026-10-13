export type CodePreviewMode = "code" | "preview";

export function isDarkTheme(theme: string | undefined): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
