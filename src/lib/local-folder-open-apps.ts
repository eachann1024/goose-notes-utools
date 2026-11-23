export type LocalFolderOpenAppKind = "file-manager" | "editor" | "terminal";

export interface LocalFolderOpenAppCandidate {
  id: string;
  label: string;
  appName: string;
  aliases?: string[];
  commands?: string[];
  kind: LocalFolderOpenAppKind;
}

export const LOCAL_FOLDER_FILE_MANAGER_CANDIDATES: LocalFolderOpenAppCandidate[] = [
  {
    id: "finder",
    label: "访达",
    appName: "Finder",
    aliases: ["Finder"],
    kind: "file-manager",
  },
  {
    id: "path-finder",
    label: "Path Finder",
    appName: "Path Finder",
    kind: "file-manager",
  },
  {
    id: "forklift",
    label: "ForkLift",
    appName: "ForkLift",
    kind: "file-manager",
  },
  {
    id: "commander-one",
    label: "Commander One",
    appName: "Commander One",
    kind: "file-manager",
  },
];

export const LOCAL_FOLDER_EDITOR_CANDIDATES: LocalFolderOpenAppCandidate[] = [
  { id: "cursor", label: "Cursor", appName: "Cursor", commands: ["cursor"], kind: "editor" },
  { id: "trae", label: "Trae", appName: "Trae", commands: ["trae"], kind: "editor" },
  { id: "zed", label: "Zed", appName: "Zed", commands: ["zed"], kind: "editor" },
  {
    id: "vscode",
    label: "Visual Studio Code",
    appName: "Visual Studio Code",
    aliases: ["Code"],
    commands: ["code"],
    kind: "editor",
  },
  { id: "windsurf", label: "Windsurf", appName: "Windsurf", commands: ["windsurf"], kind: "editor" },
  { id: "typora", label: "Typora", appName: "Typora", commands: ["typora"], kind: "editor" },
  { id: "obsidian", label: "Obsidian", appName: "Obsidian", kind: "editor" },
  { id: "sublime-text", label: "Sublime Text", appName: "Sublime Text", aliases: ["Sublime Text 2"], commands: ["subl"], kind: "editor" },
  { id: "vscodium", label: "VSCodium", appName: "VSCodium", commands: ["codium"], kind: "editor" },
  { id: "coteditor", label: "CotEditor", appName: "CotEditor", kind: "editor" },
  { id: "bbedit", label: "BBEdit", appName: "BBEdit", commands: ["bbedit"], kind: "editor" },
  { id: "textmate", label: "TextMate", appName: "TextMate", commands: ["mate"], kind: "editor" },
  { id: "nova", label: "Nova", appName: "Nova", kind: "editor" },
  { id: "webstorm", label: "WebStorm", appName: "WebStorm", aliases: ["JetBrains WebStorm"], kind: "editor" },
  { id: "intellij-idea", label: "IntelliJ IDEA", appName: "IntelliJ IDEA", aliases: ["IntelliJ IDEA Ultimate", "IntelliJ IDEA CE"], kind: "editor" },
  { id: "pycharm", label: "PyCharm", appName: "PyCharm", aliases: ["PyCharm Professional", "PyCharm CE"], kind: "editor" },
  { id: "goland", label: "GoLand", appName: "GoLand", kind: "editor" },
  { id: "phpstorm", label: "PhpStorm", appName: "PhpStorm", kind: "editor" },
  { id: "rubymine", label: "RubyMine", appName: "RubyMine", kind: "editor" },
  { id: "clion", label: "CLion", appName: "CLion", kind: "editor" },
  { id: "fleet", label: "Fleet", appName: "Fleet", kind: "editor" },
];

export const LOCAL_FOLDER_TERMINAL_CANDIDATES: LocalFolderOpenAppCandidate[] = [
  { id: "terminal", label: "终端", appName: "Terminal", aliases: ["Terminal"], kind: "terminal" },
  { id: "iterm", label: "iTerm2", appName: "iTerm", aliases: ["iTerm2"], kind: "terminal" },
  { id: "ghostty", label: "Ghostty", appName: "Ghostty", commands: ["ghostty"], kind: "terminal" },
  { id: "wezterm", label: "WezTerm", appName: "WezTerm", commands: ["wezterm"], kind: "terminal" },
  { id: "warp", label: "Warp", appName: "Warp", kind: "terminal" },
  { id: "kitty", label: "Kitty", appName: "kitty", aliases: ["Kitty"], commands: ["kitty"], kind: "terminal" },
  { id: "alacritty", label: "Alacritty", appName: "Alacritty", commands: ["alacritty"], kind: "terminal" },
  { id: "tabby", label: "Tabby", appName: "Tabby", commands: ["tabby"], kind: "terminal" },
  { id: "hyper", label: "Hyper", appName: "Hyper", commands: ["hyper"], kind: "terminal" },
  { id: "rio", label: "Rio", appName: "Rio", commands: ["rio"], kind: "terminal" },
  { id: "cmux", label: "Cmux", appName: "Cmux", commands: ["cmux"], kind: "terminal" },
  { id: "otty", label: "Otty", appName: "Otty", commands: ["otty"], kind: "terminal" },
  { id: "kero", label: "Kero", appName: "Kero", kind: "terminal" },
];

const CANDIDATES_BY_KIND: Record<
  LocalFolderOpenAppKind,
  LocalFolderOpenAppCandidate[]
> = {
  "file-manager": LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  editor: LOCAL_FOLDER_EDITOR_CANDIDATES,
  terminal: LOCAL_FOLDER_TERMINAL_CANDIDATES,
};

const ALL_CANDIDATES: LocalFolderOpenAppCandidate[] = [
  ...LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  ...LOCAL_FOLDER_EDITOR_CANDIDATES,
  ...LOCAL_FOLDER_TERMINAL_CANDIDATES,
];

/**
 * 将设置值规范化为固定候选枚举 ID；兼容旧版保存的 appName / alias，
 * 不在候选表内的任意自定义命令直接归零为系统默认（""）。
 */
export function normalizeLocalFolderAppId(
  kind: LocalFolderOpenAppKind,
  value: unknown,
): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase().replace(/\.app$/i, "");
  const list = CANDIDATES_BY_KIND[kind] ?? [];
  const matched = list.find((candidate) => {
    if (candidate.id.toLowerCase() === lower) return true;
    if (candidate.appName.toLowerCase() === lower) return true;
    if (candidate.aliases?.some((a) => a.toLowerCase() === lower)) return true;
    if (candidate.commands?.some((c) => c.toLowerCase() === lower)) return true;
    return false;
  });
  return matched ? matched.id : "";
}

export function formatLocalFolderOpenAppName(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  const matched = ALL_CANDIDATES.find(
    (c) =>
      c.id.toLowerCase() === lower ||
      c.appName.toLowerCase() === lower ||
      c.aliases?.some((a) => a.toLowerCase() === lower),
  );
  if (matched) return matched.label;
  return fallback;
}
