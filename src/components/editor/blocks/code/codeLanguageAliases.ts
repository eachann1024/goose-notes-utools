export const LANGUAGE_ALIASES: Record<string, string> = {
  // 常见 shell 别名
  sh: "bash",
  shell: "bash",
  // C/C++
  "c++": "cpp",
  // C#
  "c#": "csharp",
  cs: "csharp",
  // Go
  golang: "go",
  // LaTeX
  tex: "latex",
  math: "latex",
  // YAML
  yml: "yaml",
  "yaml-frontmatter": "yaml",
  frontmatter: "yaml",
  // Markdown
  md: "markdown",
  mkdown: "markdown",
  mkd: "markdown",
  // Python
  py: "python",
  // TypeScript
  ts: "typescript",
  tsx: "typescript",
  // JavaScript
  js: "javascript",
  jsx: "javascript",
  // Rust
  rs: "rust",
  // Ruby
  rb: "ruby",
  // Objective-C
  objc: "objectivec",
  objectc: "objectivec",
  // CoffeeScript
  coffee: "coffeescript",
  // PowerShell
  ps1: "powershell",
  ps: "powershell",
  // Kotlin
  kt: "kotlin",
  // Dockerfile
  docker: "dockerfile",
};

export const SKIP_HIGHLIGHT_LANGUAGES = new Set(["none"]);

export const AUTO_HIGHLIGHT_LANGUAGES = new Set(["plain", "plaintext", "text", "txt"]);

export function normalizeHighlightLanguage(language: string | undefined) {
  const normalized = (language || "text").trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}
