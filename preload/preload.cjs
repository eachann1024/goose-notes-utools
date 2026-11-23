window.ztools = window.ztools || window.utools
window.utools = window.utools || window.ztools
if (typeof utools === 'undefined' && window.utools) {
  globalThis.utools = window.utools
}

// preload 运行在 CJS，避免与主项目 ESM 冲突
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const { URL: NodeURL, pathToFileURL } = require("url");
const {
  buildLocalPageId,
  createSnippet,
  extractMarkdownTitle,
  extractTextFromPageContent,
  extractTitleFromPageContent,
  getNextOffset,
  parsePersistedNotebooks,
  searchNoteItems,
  sortNoteItems,
  stripMarkdownSyntax,
} = require("./mcp-tools.cjs");
const { fetchPublicText } = require("./web-fetch.cjs");
const {
  shouldHideOnHotkeyRetrigger,
  hidePluginToBackground,
} = require("./pluginHotkeyToggle.cjs");

if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;
  try {
    window.__gooseSystemInfo = {
      osVersion: os.release(),
      arch: process.arch,
    };
  } catch {
    /* noop */
  }
  const PENDING_OPEN_FOLDER_KEY = "__gooseNotePendingOpenFolder";
  const SETTINGS_STORAGE_KEY = "goose-note-settings";
  const NOTEBOOK_STORAGE_KEY = "goose-note-notebooks";
  const INTERNAL_PAGE_DOC_PREFIX = "gn:page:";
  const STORAGE_FALLBACK_DOC_PREFIX = "gn:storage:";
  const UTOOLS_WINDOW_HEIGHT_MIN = 600;
  const UTOOLS_WINDOW_HEIGHT_MAX = 1200;
  const LOCAL_NOTE_SCAN_CACHE_TTL_MS = 3000;
  const LOCAL_IGNORED_FOLDERS = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vscode",
    ".idea",
    "target",
    "__pycache__",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
  ]);
  const localNotebookScanCache = new Map();

  const clampWindowHeight = (height) => {
    const normalized = Number(height);
    if (!Number.isFinite(normalized)) return UTOOLS_WINDOW_HEIGHT_MIN;
    return Math.min(
      UTOOLS_WINDOW_HEIGHT_MAX,
      Math.max(UTOOLS_WINDOW_HEIGHT_MIN, Math.round(normalized)),
    );
  };

  const getStorageDocId = (storageKey) => `${STORAGE_FALLBACK_DOC_PREFIX}${storageKey}`;

  const readStoredDocString = (storageKey) => {
    try {
      if (utools?.db?.get) {
        const doc = utools.db.get(getStorageDocId(storageKey));
        if (typeof doc?.data === "string") {
          return doc.data;
        }
        if (typeof doc?.data?.value === "string") {
          return doc.data.value;
        }
      }
    } catch (error) {
      console.error("[goose-note] read storage doc failed:", error);
    }
    return null;
  };

  const writeStoredDocString = (storageKey, value) => {
    try {
      if (utools?.db?.put && utools?.db?.get) {
        const docId = getStorageDocId(storageKey);
        const current = utools.db.get(docId);
        let result = utools.db.put({
          _id: docId,
          _rev: current?._rev,
          data: {
            value,
            updatedAt: Date.now(),
          },
        });
        if (result?.ok !== false) return true;

        const latest = utools.db.get(docId);
        result = utools.db.put({
          _id: docId,
          _rev: latest?._rev,
          data: {
            value,
            updatedAt: Date.now(),
          },
        });
        if (result?.ok !== false) return true;
      }
    } catch (error) {
      console.error("[goose-note] write storage doc failed:", error);
    }
    return false;
  };

  const removeDbStorageString = (storageKey) => {
    try {
      if (typeof utools?.dbStorage?.removeItem === "function") {
        utools.dbStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error("[goose-note] remove dbStorage failed:", error);
    }
  };

  const readStoredString = (storageKey) => {
    const storedValue = readStoredDocString(storageKey);
    if (storedValue !== null) return storedValue;

    try {
      if (typeof utools?.dbStorage?.getItem === "function") {
        const value = utools.dbStorage.getItem(storageKey);
        if (typeof value === "string") {
          if (writeStoredDocString(storageKey, value)) {
            removeDbStorageString(storageKey);
          }
          return value;
        }
      }
    } catch (error) {
      console.error("[goose-note] read dbStorage failed:", error);
    }

    return null;
  };

  const writeStoredString = (storageKey, value) => {
    if (writeStoredDocString(storageKey, value)) {
      removeDbStorageString(storageKey);
    }
  };

  // 放在用户 home，而非插件目录 / uTools userData：卸载插件、清除插件数据后仍保留。
  // 固定版本号表示这一次宣传活动；不提供删除接口，也不借用笔记本的初始化状态。
  const THINKLY_NOTICE_KEY = "goose-note-thinkly-desktop-notice-v1-seen";
  const thinklyNoticeMarkerPath = () => {
    const homeDir =
      (typeof utools?.getPath === "function" && utools.getPath("home")) ||
      os.homedir();
    return path.join(homeDir, ".goose-note", "thinkly-desktop-notice-v1.seen");
  };

  const markThinklyNoticeSeen = () => {
    if (!writeStoredDocString(THINKLY_NOTICE_KEY, "1")) {
      try {
        utools.dbStorage?.setItem(THINKLY_NOTICE_KEY, "1");
      } catch (error) {
        console.error("[goose-note] persist Thinkly notice in database failed:", error);
      }
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(THINKLY_NOTICE_KEY, "1");
      }
    } catch (error) {
      console.error("[goose-note] persist Thinkly notice in localStorage failed:", error);
    }
    try {
      const marker = thinklyNoticeMarkerPath();
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      try {
        fs.writeFileSync(marker, "seen\n", { flag: "wx", mode: 0o600 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      return true;
    } catch (error) {
      console.error("[goose-note] persist Thinkly notice in home failed:", error);
      return false;
    }
  };

  window.gooseFirstRunNotice = {
    hasSeen: () => {
      try {
        const databaseSeen = readStoredString(THINKLY_NOTICE_KEY) !== null;
        let localStorageSeen = false;
        try {
          localStorageSeen =
            typeof window !== "undefined" &&
            Boolean(window.localStorage?.getItem(THINKLY_NOTICE_KEY));
        } catch {
          // ignore localStorage access error
        }
        let fileSeen = false;
        try {
          fileSeen = fs.existsSync(thinklyNoticeMarkerPath());
        } catch {
          // ignore fs access error
        }
        const seen = databaseSeen || localStorageSeen || fileSeen;
        // 任一处存在即视为已展示（并自动补写缺失项）
        if (seen) {
          if (!databaseSeen || !localStorageSeen || !fileSeen) {
            markThinklyNoticeSeen();
          }
          return true;
        }
        return false;
      } catch (error) {
        // 无法确定是否展示过时不打扰用户。
        console.error("[goose-note] read Thinkly notice marker failed:", error);
        return true;
      }
    },
    markSeen: markThinklyNoticeSeen,
  };

  const readStoredSettingsWindowHeight = () => {
    const parseWindowHeight = (rawValue) => {
      if (typeof rawValue !== "string" || !rawValue) return null;
      try {
        const parsed = JSON.parse(rawValue);
        return clampWindowHeight(parsed?.state?.utools?.windowHeight);
      } catch (error) {
        console.error("[goose-note] parse persisted settings failed:", error);
        return null;
      }
    };

    const storedValue = readStoredString(SETTINGS_STORAGE_KEY);
    const parsedHeight = parseWindowHeight(storedValue);
    if (parsedHeight !== null) return parsedHeight;

    return null;
  };

  const applyStoredWindowHeightBeforeRender = () => {
    try {
      const storedHeight = readStoredSettingsWindowHeight();
      const initialHeight = storedHeight ?? UTOOLS_WINDOW_HEIGHT_MIN;
      if (typeof utools?.setExpendHeight === "function") {
        utools.setExpendHeight(initialHeight);
      }
    } catch (error) {
      console.error("[goose-note] apply initial window height failed:", error);
    }
  };

  applyStoredWindowHeightBeforeRender();

  const invalidateLocalNotebookCache = () => {
    localNotebookScanCache.clear();
  };

  const clampLimit = (value, fallback) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return fallback;
    return Math.min(500, Math.max(1, Math.floor(normalized)));
  };

  const clampOffset = (value, fallback = 0) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return fallback;
    return Math.max(0, Math.floor(normalized));
  };

  const normalizeStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  };

  const listPersistedNotebooks = () => {
    const notebooks = parsePersistedNotebooks(readStoredString(NOTEBOOK_STORAGE_KEY));
    return notebooks.length > 0
      ? notebooks
      : [
          {
            id: "default-notebook",
            name: "Note",
            source: "default",
          },
        ];
  };

  // 本地文件变更监听映射
  const watchers = new Map();
  // 最近写入的文件标记，用于避免自己写入触发重载提示
  const recentWrites = new Map();
  const RECENT_WRITE_WINDOW_MS = 2000;

  const markRecentWrite = (filePath) => {
    recentWrites.set(filePath, Date.now());
  };

  const tryTrash = async (targetPath) => {
    try {
      if (utools?.shellTrashItem) {
        await utools.shellTrashItem(targetPath);
        return true;
      }
    } catch (err) {
      console.error("[gooseFs] shellTrashItem failed:", err);
    }

    return false;
  };

  const trashCandidateDirs = () => {
    if (process.platform === "darwin") {
      return [path.join(os.homedir(), ".Trash")];
    }
    if (process.platform === "linux") {
      return [path.join(os.homedir(), ".local/share/Trash/files")];
    }
    return [];
  };

  const restoreFromTrash = async (destPath) => {
    try {
      if (!destPath || fs.existsSync(destPath)) return false;
      const name = path.basename(destPath);
      if (!name || name === "." || name === "..") return false;

      const matches = [];
      for (const dir of trashCandidateDirs()) {
        if (!fs.existsSync(dir)) continue;
        let entries = [];
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (!entry.isFile() || entry.name !== name) continue;
          const full = path.join(dir, entry.name);
          try {
            const info = await fs.promises.stat(full);
            matches.push({ path: full, mtimeMs: info.mtimeMs });
          } catch {
            // skip unreadable trash entries
          }
        }
      }
      if (matches.length === 0) return false;
      matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const source = matches[0]?.path;
      if (!source) return false;
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      await fs.promises.copyFile(source, destPath);
      try {
        await fs.promises.unlink(source);
      } catch {
        // restored copy is enough
      }
      if (fs.existsSync(destPath)) {
        markRecentWrite(destPath);
        invalidateLocalNotebookCache();
        return true;
      }
      return false;
    } catch (err) {
      console.error("[gooseFs] restoreFromTrash failed:", err);
      return false;
    }
  };

  const resolveWriteEncoding = (encoding) =>
    encoding === "base64" || encoding === "binary" ? "base64" : "utf-8";

  const resolveTempTargetPath = (relativePath) => {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
      throw new Error("relativePath is required");
    }

    const tmpRoot = fs.realpathSync(os.tmpdir());
    const normalized = path
      .normalize(relativePath)
      .replace(/^(\.\.(\/|\\|$))+/, "")
      .replace(/^[/\\]+/, "");
    const targetPath = path.join(tmpRoot, normalized);

    if (
      targetPath !== tmpRoot &&
      !targetPath.startsWith(`${tmpRoot}${path.sep}`)
    ) {
      throw new Error("invalid temp path");
    }

    return targetPath;
  };

  const getBase64ByteLength = (contentBase64) => {
    const sanitized = String(contentBase64 || "").replace(/\s+/g, "");
    if (!sanitized) return 0;
    const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
    return Math.floor((sanitized.length * 3) / 4) - padding;
  };

  const removeExpiredEntries = async (targetPath, cutoff) => {
    let stat;
    try {
      stat = await fs.promises.stat(targetPath);
    } catch {
      return;
    }

    if (stat.isDirectory()) {
      let children = [];
      try {
        children = await fs.promises.readdir(targetPath);
      } catch {
        return;
      }

      await Promise.all(
        children.map((child) => removeExpiredEntries(path.join(targetPath, child), cutoff)),
      );

      try {
        const remaining = await fs.promises.readdir(targetPath);
        if (remaining.length === 0) {
          await fs.promises.rmdir(targetPath);
        }
      } catch {}
      return;
    }

    if (stat.mtimeMs >= cutoff) return;

    try {
      await fs.promises.unlink(targetPath);
    } catch (err) {
      console.error("[gooseFs] cleanup temp file failed:", err);
    }
  };

  const isPathCaseInsensitive = () =>
    process.platform === "win32" || process.platform === "darwin";

  const mountedRoots = new Set();

  const isPathInsideRoot = (candidateRealPath, rootRealPath) => {
    const normalize = (value) =>
      isPathCaseInsensitive() ? value.toLowerCase() : value;
    const target = normalize(candidateRealPath);
    const root = normalize(rootRealPath);
    return target === root || target.startsWith(`${root}${path.sep}`);
  };

  const addMountedRoot = (dirPath) => {
    if (typeof dirPath !== "string" || !dirPath.trim()) return null;
    try {
      const real = fs.realpathSync(dirPath.trim());
      const stat = fs.statSync(real);
      if (!stat.isDirectory()) return null;
      mountedRoots.add(real);
      return real;
    } catch {
      return null;
    }
  };

  // 启动时将已持久化的本地文件夹笔记本纳入根目录白名单
  try {
    for (const notebook of listPersistedNotebooks()) {
      if (notebook?.source === "local-folder" && typeof notebook.localPath === "string") {
        addMountedRoot(notebook.localPath);
      }
    }
  } catch {
    /* noop */
  }

  // 校验目标路径（不存在时校验最近已存在祖先目录的 realpath）是否落在已挂载根目录内
  const resolveSafePath = (targetPath) => {
    if (typeof targetPath !== "string" || !targetPath.trim()) return null;
    if (mountedRoots.size === 0) return null;

    let absPath;
    try {
      absPath = path.resolve(targetPath.trim());
    } catch {
      return null;
    }

    let cursor = absPath;
    while (!fs.existsSync(cursor)) {
      const parent = path.dirname(cursor);
      if (!parent || parent === cursor) return null;
      cursor = parent;
    }

    let ancestorReal;
    try {
      ancestorReal = fs.realpathSync(cursor);
    } catch {
      return null;
    }

    const rel = path.relative(cursor, absPath);
    const effectiveRealPath = rel ? path.join(ancestorReal, rel) : ancestorReal;

    for (const root of mountedRoots) {
      if (isPathInsideRoot(effectiveRealPath, root)) {
        return effectiveRealPath;
      }
    }
    return null;
  };

  const revealItemInFolder = (targetPath) => {
    const safePath = resolveSafePath(targetPath);
    if (!safePath) return false;
    try {
      if (typeof utools?.shellShowItemInFolder === "function") {
        return !!utools.shellShowItemInFolder(safePath);
      }
    } catch (err) {
      console.error("[gooseFs] utools shellShowItemInFolder failed:", err);
    }

    try {
      if (typeof utools?.shellOpenPath === "function") {
        return !!utools.shellOpenPath(path.dirname(safePath));
      }
    } catch (err) {
      console.error("[gooseFs] utools shellOpenPath failed:", err);
    }

    return false;
  };

  const OPEN_APP_CANDIDATES = [
    { id: "finder", appName: "Finder", aliases: ["Finder"], kind: "file-manager" },
    { id: "path-finder", appName: "Path Finder", kind: "file-manager" },
    { id: "forklift", appName: "ForkLift", kind: "file-manager" },
    { id: "commander-one", appName: "Commander One", kind: "file-manager" },
    { id: "cursor", appName: "Cursor", commands: ["cursor"], kind: "editor" },
    { id: "trae", appName: "Trae", commands: ["trae"], kind: "editor" },
    { id: "zed", appName: "Zed", commands: ["zed"], kind: "editor" },
    { id: "vscode", appName: "Visual Studio Code", aliases: ["Code"], commands: ["code"], kind: "editor" },
    { id: "windsurf", appName: "Windsurf", commands: ["windsurf"], kind: "editor" },
    { id: "typora", appName: "Typora", commands: ["typora"], kind: "editor" },
    { id: "obsidian", appName: "Obsidian", kind: "editor" },
    { id: "sublime-text", appName: "Sublime Text", aliases: ["Sublime Text 2"], commands: ["subl"], kind: "editor" },
    { id: "vscodium", appName: "VSCodium", commands: ["codium"], kind: "editor" },
    { id: "coteditor", appName: "CotEditor", kind: "editor" },
    { id: "bbedit", appName: "BBEdit", commands: ["bbedit"], kind: "editor" },
    { id: "textmate", appName: "TextMate", commands: ["mate"], kind: "editor" },
    { id: "nova", appName: "Nova", kind: "editor" },
    { id: "webstorm", appName: "WebStorm", aliases: ["JetBrains WebStorm"], kind: "editor" },
    { id: "intellij-idea", appName: "IntelliJ IDEA", aliases: ["IntelliJ IDEA Ultimate", "IntelliJ IDEA CE"], kind: "editor" },
    { id: "pycharm", appName: "PyCharm", aliases: ["PyCharm Professional", "PyCharm CE"], kind: "editor" },
    { id: "goland", appName: "GoLand", kind: "editor" },
    { id: "phpstorm", appName: "PhpStorm", kind: "editor" },
    { id: "rubymine", appName: "RubyMine", kind: "editor" },
    { id: "clion", appName: "CLion", kind: "editor" },
    { id: "fleet", appName: "Fleet", kind: "editor" },
    { id: "terminal", appName: "Terminal", aliases: ["Terminal"], kind: "terminal" },
    { id: "iterm", appName: "iTerm", aliases: ["iTerm2"], kind: "terminal" },
    { id: "ghostty", appName: "Ghostty", commands: ["ghostty"], kind: "terminal" },
    { id: "wezterm", appName: "WezTerm", commands: ["wezterm"], kind: "terminal" },
    { id: "warp", appName: "Warp", kind: "terminal" },
    { id: "kitty", appName: "kitty", aliases: ["Kitty"], commands: ["kitty"], kind: "terminal" },
    { id: "alacritty", appName: "Alacritty", commands: ["alacritty"], kind: "terminal" },
    { id: "tabby", appName: "Tabby", commands: ["tabby"], kind: "terminal" },
    { id: "hyper", appName: "Hyper", commands: ["hyper"], kind: "terminal" },
    { id: "rio", appName: "Rio", commands: ["rio"], kind: "terminal" },
    { id: "cmux", appName: "Cmux", commands: ["cmux"], kind: "terminal" },
    { id: "otty", appName: "Otty", commands: ["otty"], kind: "terminal" },
    { id: "kero", appName: "Kero", kind: "terminal" },
  ];

  const OPEN_APP_BY_ID = new Map(OPEN_APP_CANDIDATES.map((c) => [c.id, c]));

  const getCandidateNames = (candidate) => {
    const names = [candidate?.appName, ...(candidate?.aliases || [])]
      .filter((item) => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().replace(/\.app$/i, ""));
    return Array.from(new Set(names));
  };

  const macApplicationRoots = () => [
    "/Applications",
    "/System/Applications",
    "/System/Applications/Utilities",
    "/System/Library/CoreServices",
    path.join(os.homedir(), "Applications"),
  ];

  const commandPathCache = new Map(); // command -> resolved executable path | null
  const macAppExistsCache = new Map(); // bundle path -> boolean
  const listAvailableOpenAppsCache = new Map(); // signature -> resolved candidates

  const getCandidatesSignature = (candidates) =>
    candidates
      .map((c) =>
        [
          c?.id,
          c?.appName,
          (Array.isArray(c?.aliases) ? c.aliases : []).join("|"),
          (Array.isArray(c?.commands) ? c.commands : []).join("|"),
          c?.kind,
        ].join("~"),
      )
      .join(";;");

  const macAppExists = (bundlePath) => {
    if (macAppExistsCache.has(bundlePath)) {
      return macAppExistsCache.get(bundlePath);
    }
    let exists = false;
    try {
      exists = fs.existsSync(bundlePath);
    } catch {
      exists = false;
    }
    macAppExistsCache.set(bundlePath, exists);
    return exists;
  };

  const resolveMacAppBundlePath = (candidate) => {
    for (const name of getCandidateNames(candidate)) {
      const bundleName = `${name}.app`;
      for (const root of macApplicationRoots()) {
        const bundlePath = path.join(root, bundleName);
        if (macAppExists(bundlePath)) {
          return { name, bundlePath };
        }
      }
    }
    return null;
  };

  const findCommandInPath = (command) => {
    if (typeof command !== "string") return null;
    const normalized = command.trim();
    // 仅允许纯命令名，拒绝路径分隔符或参数注入
    if (!normalized || /[/\\\s]/.test(normalized)) return null;
    if (commandPathCache.has(normalized)) {
      return commandPathCache.get(normalized);
    }

    const pathEnv = process.env.PATH || "";
    const dirs = pathEnv.split(path.delimiter).filter(Boolean);
    const exts =
      process.platform === "win32"
        ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
            .split(";")
            .filter(Boolean)
        : [""];

    let resolved = null;
    for (const dir of dirs) {
      for (const ext of exts) {
        const candidatePath = path.join(
          dir,
          process.platform === "win32" && !normalized.toLowerCase().endsWith(ext.toLowerCase())
            ? `${normalized}${ext}`
            : normalized,
        );
        try {
          const stat = fs.statSync(candidatePath);
          if (!stat.isFile()) continue;
          if (process.platform !== "win32") {
            fs.accessSync(candidatePath, fs.constants.X_OK);
          }
          resolved = candidatePath;
          break;
        } catch {
          // continue searching PATH
        }
      }
      if (resolved) break;
    }

    commandPathCache.set(normalized, resolved);
    return resolved;
  };

  const resolveOpenAppCandidate = async (candidate) => {
    if (!candidate || typeof candidate !== "object") return null;
    const whitelisted = typeof candidate.id === "string" ? OPEN_APP_BY_ID.get(candidate.id) : null;
    if (!whitelisted) return null;

    if (process.platform === "darwin") {
      const macMatch = resolveMacAppBundlePath(whitelisted);
      if (macMatch) return { ...whitelisted, appName: macMatch.name };
    }

    const commands = Array.isArray(whitelisted.commands) ? whitelisted.commands : [];
    for (const command of commands) {
      if (findCommandInPath(command)) return { ...whitelisted, appName: command };
    }

    return null;
  };

  const yieldToEventLoop = () =>
    new Promise((resolve) => {
      if (typeof setImmediate === "function") {
        setImmediate(resolve);
        return;
      }
      setTimeout(resolve, 0);
    });

  const listAvailableOpenApps = async (candidates) => {
    if (!Array.isArray(candidates)) return [];
    const key = `${process.platform}::${getCandidatesSignature(candidates)}`;
    if (listAvailableOpenAppsCache.has(key)) {
      return listAvailableOpenAppsCache.get(key);
    }
    const resolved = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const item = await resolveOpenAppCandidate(candidates[i]);
      if (item) resolved.push(item);
      // macOS 只做 existsSync 时仍分片让出，避免一次扫完整候选列表卡住 UI。
      if (i < candidates.length - 1 && (i + 1) % 3 === 0) {
        await yieldToEventLoop();
      }
    }
    listAvailableOpenAppsCache.set(key, resolved);
    return resolved;
  };

  const finishChildLaunch = (child, resolve, fallback) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timeout = setTimeout(() => done(true), 3000);
    child.on("error", () => {
      clearTimeout(timeout);
      if (fallback) {
        void fallback().then(done);
        return;
      }
      done(false);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        done(true);
        return;
      }
      if (fallback) {
        void fallback().then(done);
        return;
      }
      done(false);
    });
    child.on("spawn", () => {
      if (process.platform !== "darwin") {
        clearTimeout(timeout);
        done(true);
      }
    });
    child.unref();
  };

  const spawnWhitelisted = (executable, args) =>
    new Promise((resolve) => {
      try {
        const child = spawn(executable, args, {
          detached: true,
          stdio: "ignore",
          shell: false,
        });
        finishChildLaunch(child, resolve);
      } catch (err) {
        console.error("[gooseFs] spawnWhitelisted failed:", err);
        resolve(false);
      }
    });

  const launchWhitelistedApp = (candidate, safeTargetPath) => {
    if (!candidate) return Promise.resolve(false);

    if (process.platform === "darwin") {
      const macMatch = resolveMacAppBundlePath(candidate);
      if (macMatch) {
        return spawnWhitelisted("/usr/bin/open", [
          "-a",
          macMatch.bundlePath,
          safeTargetPath,
        ]);
      }
    }

    const commands = Array.isArray(candidate.commands) ? candidate.commands : [];
    for (const command of commands) {
      const exePath = findCommandInPath(command);
      if (exePath) {
        return spawnWhitelisted(exePath, [safeTargetPath]);
      }
    }

    return Promise.resolve(false);
  };

  const openWithApp = (targetPath, appId) => {
    const safeTargetPath = resolveSafePath(targetPath);
    if (!safeTargetPath) return Promise.resolve(false);

    const id = typeof appId === "string" ? appId.trim() : "";
    const candidate = OPEN_APP_BY_ID.get(id);
    if (!candidate || candidate.kind === "terminal") {
      return Promise.resolve(false);
    }

    return launchWhitelistedApp(candidate, safeTargetPath);
  };

  const resolveDirectoryTarget = (targetPath) => {
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) return targetPath;
      return path.dirname(targetPath);
    } catch {
      return targetPath;
    }
  };

  const openTerminalAtPath = (targetPath, terminalId) => {
    const safeTargetPath = resolveSafePath(targetPath);
    if (!safeTargetPath) return Promise.resolve(false);
    const dirPath = resolveDirectoryTarget(safeTargetPath);

    const id = typeof terminalId === "string" ? terminalId.trim() : "";
    if (!id) {
      if (process.platform === "darwin") {
        return launchWhitelistedApp(OPEN_APP_BY_ID.get("terminal"), dirPath);
      }
      if (process.platform === "win32") {
        const cmdExe = findCommandInPath("cmd.exe") || "cmd.exe";
        return spawnWhitelisted(cmdExe, [
          "/c",
          "start",
          "",
          "cmd.exe",
          "/K",
          "cd",
          "/d",
          dirPath,
        ]);
      }
      const linuxTerm =
        findCommandInPath("x-terminal-emulator") ||
        findCommandInPath("gnome-terminal") ||
        findCommandInPath("konsole");
      return linuxTerm
        ? spawnWhitelisted(linuxTerm, [dirPath])
        : Promise.resolve(false);
    }

    const candidate = OPEN_APP_BY_ID.get(id);
    if (!candidate || candidate.kind !== "terminal") {
      return Promise.resolve(false);
    }
    return launchWhitelistedApp(candidate, dirPath);
  };

  const getNotebookAvailability = (notebook) => {
    if (notebook?.source !== "local-folder") return "ready";
    if (!notebook.localPath) return "path_missing";
    if (!fs.existsSync(notebook.localPath)) return "path_missing";
    try {
      fs.accessSync(notebook.localPath, fs.constants.R_OK);
      return "ready";
    } catch {
      return "unreadable";
    }
  };

  const buildNotebookSummary = (notebook, options = {}) => {
    const includeLocalPaths = options.includeLocalPaths === true;
    const summary = {
      id: notebook.id,
      name: notebook.name,
      source: notebook.source === "local-folder" ? "local-folder" : "default",
      availability: getNotebookAvailability(notebook),
    };

    if (
      includeLocalPaths &&
      notebook.source === "local-folder" &&
      typeof notebook.localPath === "string"
    ) {
      summary.localPath = notebook.localPath;
    }

    return summary;
  };

  const createInternalNoteRecord = (page, notebooksMap) => {
    const notebook = notebooksMap.get(page.workspaceId);
    const title = extractTitleFromPageContent(page.content);
    const contentText = extractTextFromPageContent(page.content);
    return {
      id: page.id,
      title,
      notebookId: page.workspaceId,
      notebookName: notebook?.name || "未知记事本",
      sourceType: "app-page",
      parentId: typeof page.parentId === "string" ? page.parentId : undefined,
      createdAt: Number(page.createdAt || 0),
      updatedAt: Number(page.updatedAt || 0),
      isFolder: page.isFolder === true,
      trashedAt: typeof page.trashedAt === "number" ? page.trashedAt : undefined,
      snippet: createSnippet(contentText),
      contentText,
      rawContentFormat: "blocknote_json",
      rawContent: page.content,
    };
  };

  const listInternalNotes = (notebooksMap) => {
    if (typeof utools?.db?.allDocs !== "function") return [];

    try {
      return utools.db
        .allDocs(INTERNAL_PAGE_DOC_PREFIX)
        .map((doc) => doc?.data)
        .filter((page) => page && typeof page.id === "string")
        .map((page) => createInternalNoteRecord(page, notebooksMap));
    } catch (error) {
      console.error("[goose-note] list internal notes failed:", error);
      return [];
    }
  };

  const shouldIgnoreLocalEntry = (name) =>
    typeof name === "string" &&
    (name.startsWith(".") || LOCAL_IGNORED_FOLDERS.has(name));

  const IGNORED_WATCH_BASENAMES = new Set(["thumbs.db", "desktop.ini"]);
  const IGNORED_WATCH_SUFFIXES = [".swp", ".swx", ".tmp", ".crswap", ".part"];

  const shouldIgnoreWatchFilename = (filename) => {
    if (typeof filename !== "string" || !filename) return false;
    const segments = filename.split(/[/\\]/).filter(Boolean);
    for (const segment of segments) {
      if (segment.startsWith(".")) return true;
      if (segment === "node_modules") return true;
      if (segment.startsWith("~$")) return true;
      const lower = segment.toLowerCase();
      if (IGNORED_WATCH_BASENAMES.has(lower)) return true;
      if (IGNORED_WATCH_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
    }
    return false;
  };

  const scanLocalNotebookNotes = async (notebook) => {
    const cacheKey = notebook.id;
    const cached = localNotebookScanCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const availability = getNotebookAvailability(notebook);
    if (availability !== "ready") {
      const result = { availability, items: [] };
      localNotebookScanCache.set(cacheKey, {
        expiresAt: now + LOCAL_NOTE_SCAN_CACHE_TTL_MS,
        value: result,
      });
      return result;
    }

    const scanDirectory = async (dirPath, parentId) => {
      let entries;
      try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        throw error;
      }

      const sortedEntries = [...entries].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-CN", { numeric: true }),
      );
      const items = [];

      for (const entry of sortedEntries) {
        if (shouldIgnoreLocalEntry(entry.name)) continue;
        const entryPath = path.join(dirPath, entry.name);

        let stats;
        try {
          stats = await fs.promises.stat(entryPath);
        } catch {
          continue;
        }

        if (entry.isDirectory()) {
          const folderId = buildLocalPageId(notebook.id, notebook.localPath, entryPath);
          items.push({
            id: folderId,
            title: entry.name,
            notebookId: notebook.id,
            notebookName: notebook.name,
            sourceType: "local-file",
            parentId,
            createdAt: Number(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs || now),
            updatedAt: Number(stats.mtimeMs || now),
            isFolder: true,
            localFilePath: entryPath,
            snippet: "",
            contentText: "",
            rawContentFormat: "markdown",
            rawContent: "",
          });
          const childItems = await scanDirectory(entryPath, folderId);
          items.push(...childItems);
          continue;
        }

        if (!entry.isFile() || !/\.(md|markdown)$/i.test(entry.name)) continue;

        let markdown = "";
        try {
          markdown = await fs.promises.readFile(entryPath, "utf-8");
        } catch {
          continue;
        }

        const fallbackTitle = entry.name.replace(/\.(md|markdown)$/i, "").trim() || "无标题";
        const contentText = stripMarkdownSyntax(markdown);
        items.push({
          id: buildLocalPageId(notebook.id, notebook.localPath, entryPath),
          title: extractMarkdownTitle(markdown, fallbackTitle),
          notebookId: notebook.id,
          notebookName: notebook.name,
          sourceType: "local-file",
          parentId,
          createdAt: Number(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs || now),
          updatedAt: Number(stats.mtimeMs || now),
          isFolder: false,
          localFilePath: entryPath,
          snippet: createSnippet(contentText),
          contentText,
          rawContentFormat: "markdown",
          rawContent: markdown,
        });
      }

      return items;
    };

    try {
      const items = await scanDirectory(notebook.localPath, undefined);
      const result = { availability: "ready", items };
      localNotebookScanCache.set(cacheKey, {
        expiresAt: now + LOCAL_NOTE_SCAN_CACHE_TTL_MS,
        value: result,
      });
      return result;
    } catch (error) {
      console.error("[goose-note] scan local notebook failed:", error);
      const result = { availability: "unreadable", items: [] };
      localNotebookScanCache.set(cacheKey, {
        expiresAt: now + LOCAL_NOTE_SCAN_CACHE_TTL_MS,
        value: result,
      });
      return result;
    }
  };

  const listAllNotes = async () => {
    const notebooks = listPersistedNotebooks();
    const notebooksMap = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
    const internalNotes = listInternalNotes(notebooksMap);
    const localNotebooks = notebooks.filter((notebook) => notebook.source === "local-folder");
    const localResults = await Promise.all(localNotebooks.map(scanLocalNotebookNotes));
    const localNotes = localResults.flatMap((result) => result.items);

    return {
      notebooks,
      notebookSummaries: notebooks.map((notebook) => buildNotebookSummary(notebook)),
      notes: [...internalNotes, ...localNotes],
    };
  };

  const filterNotes = (notes, params = {}) => {
    const notebookIds = normalizeStringArray(params.notebook_ids);
    const sourceTypes = normalizeStringArray(params.source_types);
    const includeTrashed = params.include_trashed === true;
    const includeFolders = params.include_folders === true;

    return notes.filter((note) => {
      if (notebookIds.length > 0 && !notebookIds.includes(note.notebookId)) return false;
      if (sourceTypes.length > 0 && !sourceTypes.includes(note.sourceType)) return false;
      if (!includeTrashed && typeof note.trashedAt === "number") return false;
      if (!includeFolders && note.isFolder) return false;
      return true;
    });
  };

  const paginateItems = (items, params = {}, fallbackLimit = 100) => {
    const offset = clampOffset(params.offset, 0);
    const limit = clampLimit(params.limit, fallbackLimit);
    return {
      total: items.length,
      items: items.slice(offset, offset + limit),
    };
  };

  const buildListItem = (note) => {
    const item = {
      id: note.id,
      title: note.title,
      notebookId: note.notebookId,
      notebookName: note.notebookName,
      sourceType: note.sourceType,
      parentId: note.parentId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      isFolder: note.isFolder === true,
      snippet: note.snippet || "",
    };

    if (typeof note.localFilePath === "string") {
      item.localFilePath = note.localFilePath;
    }

    return item;
  };

  const buildGetNoteItem = (note) => {
    if (note.isFolder) {
      throw new Error("目录节点不支持 get_note，请改用 list_notes 查看目录结构。");
    }

    const item = {
      id: note.id,
      title: note.title,
      notebookId: note.notebookId,
      notebookName: note.notebookName,
      sourceType: note.sourceType,
      parentId: note.parentId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      contentText: note.contentText || "",
      rawContentFormat: note.rawContentFormat,
      rawContent: note.rawContent,
    };

    if (typeof note.trashedAt === "number") {
      item.trashedAt = note.trashedAt;
    }
    if (typeof note.localFilePath === "string") {
      item.localFilePath = note.localFilePath;
    }

    return item;
  };

  const dispatchMcpCallEvent = (tool, ok) => {
    try {
      window.dispatchEvent(
        new CustomEvent("goose-note:mcp-call", { detail: { tool, ok } }),
      );
    } catch {
      /* noop */
    }
  };

  const registerReadonlyMcpTool = (name, handler) => {
    utools.registerTool(name, async (params = {}) => {
      try {
        const result = await handler(params);
        dispatchMcpCallEvent(name, true);
        return result;
      } catch (err) {
        dispatchMcpCallEvent(name, false);
        throw err;
      }
    });
  };

  const registerMcpTools = () => {
    if (typeof utools?.registerTool !== "function") return;

    registerReadonlyMcpTool("list_notebooks", async (params = {}) => {
      const notebooks = listPersistedNotebooks();
      const items = notebooks.map((notebook) =>
        buildNotebookSummary(notebook, {
          includeLocalPaths: params.include_local_paths === true,
        }),
      );

      return { items };
    });

    registerReadonlyMcpTool("list_notes", async (params = {}) => {
      const { notes } = await listAllNotes();
      const filtered = filterNotes(notes, params);
      const sorted = sortNoteItems(filtered, params.sort_by || "updated_at_desc");
      const paged = paginateItems(sorted, params, 100);
      const items = paged.items.map(buildListItem);

      return {
        total: paged.total,
        items,
        nextOffset: getNextOffset(
          paged.total,
          clampOffset(params.offset, 0),
          paged.items.length,
        ),
      };
    });

    registerReadonlyMcpTool("search_notes", async (params = {}) => {
      const query = typeof params.query === "string" ? params.query.trim() : "";
      if (!query) {
        throw new Error("query 不能为空");
      }

      const { notes } = await listAllNotes();
      const filtered = filterNotes(notes, {
        ...params,
        include_folders: false,
      });
      const searched = searchNoteItems(filtered, query);
      const paged = paginateItems(searched, params, 50);
      const items = paged.items.map((note) => ({
        ...buildListItem(note),
        score: note.score,
        matchedFields: note.matchedFields,
      }));

      return {
        total: paged.total,
        items,
        nextOffset: getNextOffset(
          paged.total,
          clampOffset(params.offset, 0),
          paged.items.length,
        ),
      };
    });

    registerReadonlyMcpTool("get_note", async (params = {}) => {
      const noteId = typeof params.note_id === "string" ? params.note_id.trim() : "";
      if (!noteId) {
        throw new Error("note_id 不能为空");
      }

      const { notebooks, notes } = await listAllNotes();
      const note = notes.find((item) => item.id === noteId);
      if (!note) {
        const localNotebook = notebooks.find(
          (item) => item.source === "local-folder" && noteId.startsWith(`local-${item.id}-`),
        );
        if (localNotebook) {
          const availability = getNotebookAvailability(localNotebook);
          if (availability !== "ready") {
            throw new Error(
              availability === "path_missing"
                ? "对应的本地记事本路径不存在"
                : "对应的本地记事本当前不可读取",
            );
          }
        }
        throw new Error("未找到对应笔记");
      }

      return buildGetNoteItem(note);
    });
  };

  // Node 端下载远程图片，绕开渲染端 CORS。用于图片导出场景。
  // 返回 data URL（带 mime），失败返回 null。
  const fetchRemoteImage = (url, timeoutMs = 8000) => {
    const MAX_BYTES = 20 * 1024 * 1024;
    const MAX_REDIRECTS = 5;

    return new Promise((resolve) => {
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const visit = (currentUrl, redirectsLeft) => {
        let parsed;
        try {
          parsed = new NodeURL(currentUrl);
        } catch {
          finish(null);
          return;
        }
        const lib = parsed.protocol === "http:" ? http : https;
        const req = lib.get(
          currentUrl,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (GooseNote)",
              Accept: "image/*,*/*;q=0.8",
            },
          },
          (res) => {
            const status = res.statusCode || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
              if (redirectsLeft <= 0) {
                res.resume();
                finish(null);
                return;
              }
              let next;
              try {
                next = new NodeURL(res.headers.location, currentUrl).toString();
              } catch {
                res.resume();
                finish(null);
                return;
              }
              res.resume();
              visit(next, redirectsLeft - 1);
              return;
            }
            if (status < 200 || status >= 400) {
              res.resume();
              finish(null);
              return;
            }

            const chunks = [];
            let total = 0;
            res.on("data", (chunk) => {
              total += chunk.length;
              if (total > MAX_BYTES) {
                req.destroy();
                finish(null);
                return;
              }
              chunks.push(chunk);
            });
            res.on("end", () => {
              try {
                const buf = Buffer.concat(chunks);
                const rawType = res.headers["content-type"] || "image/png";
                const mime = String(rawType).split(";")[0].trim() || "image/png";
                finish(`data:${mime};base64,${buf.toString("base64")}`);
              } catch {
                finish(null);
              }
            });
            res.on("error", () => finish(null));
          },
        );
        req.setTimeout(timeoutMs, () => {
          req.destroy();
          finish(null);
        });
        req.on("error", () => finish(null));
      };

      visit(url, MAX_REDIRECTS);
    });
  };

  const MAX_AI_CONTEXT_FILE_BYTES = 256 * 1024;

  const getLocalDataDir = () => {
    try {
      if (typeof utools?.getPath === "function") {
        const dir = utools.getPath("userData");
        if (typeof dir === "string" && dir.trim()) return dir.trim();
      }
    } catch {
      /* noop */
    }
    return path.join(os.homedir(), ".goose-note");
  };

  const AI_CONTEXT_ALLOWLIST_PATH = path.join(
    getLocalDataDir(),
    "goose-note-ai-context-allowlist.json",
  );
  const allowedAiContextFiles = new Set();

  try {
    if (fs.existsSync(AI_CONTEXT_ALLOWLIST_PATH)) {
      const saved = JSON.parse(fs.readFileSync(AI_CONTEXT_ALLOWLIST_PATH, "utf-8"));
      if (Array.isArray(saved)) {
        for (const p of saved) {
          if (typeof p === "string" && /\.(md|markdown)$/i.test(p)) {
            allowedAiContextFiles.add(p);
          }
        }
      }
    }
  } catch {
    /* noop */
  }

  const persistAiContextAllowlist = () => {
    try {
      fs.mkdirSync(path.dirname(AI_CONTEXT_ALLOWLIST_PATH), { recursive: true });
      fs.writeFileSync(
        AI_CONTEXT_ALLOWLIST_PATH,
        JSON.stringify(Array.from(allowedAiContextFiles), null, 2),
        { encoding: "utf-8", mode: 0o600 },
      );
    } catch {
      /* noop */
    }
  };

  // 建议 #3：不再自动扫描 ~/AGENTS.md 或 ~/.agents/skills；
  // 仅允许用户通过原生文件选择器手动挑中的 Markdown 文件进入读取白名单。
  window.gooseAiContext = {
    selectContextFiles: async () => {
      if (typeof utools?.showOpenDialog !== "function") return [];
      try {
        const picked = await Promise.resolve(
          utools.showOpenDialog({
            title: "选择 AI 上下文文件",
            filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
            properties: ["openFile", "multiSelections"],
          }),
        );
        if (!Array.isArray(picked) || picked.length === 0) return [];
        const selected = [];
        for (const rawPath of picked) {
          if (typeof rawPath !== "string" || !/\.(md|markdown)$/i.test(rawPath)) {
            continue;
          }
          try {
            const real = fs.realpathSync(rawPath);
            const stat = fs.statSync(real);
            if (!stat.isFile() || stat.size > MAX_AI_CONTEXT_FILE_BYTES) continue;
            allowedAiContextFiles.add(real);
            selected.push({ path: real, name: path.basename(real) });
          } catch {
            /* skip unreadable */
          }
        }
        if (selected.length > 0) {
          persistAiContextAllowlist();
        }
        return selected;
      } catch {
        return [];
      }
    },
    readSelectedFiles: (paths) => {
      if (!Array.isArray(paths)) return [];
      const results = [];
      for (const rawPath of paths.slice(0, 50)) {
        if (typeof rawPath !== "string" || !/\.(md|markdown)$/i.test(rawPath)) {
          continue;
        }
        try {
          const real = fs.realpathSync(rawPath);
          if (!allowedAiContextFiles.has(real)) continue;
          const stat = fs.statSync(real);
          if (!stat.isFile() || stat.size > MAX_AI_CONTEXT_FILE_BYTES) continue;
          results.push({
            path: real,
            content: fs.readFileSync(real, "utf-8"),
          });
        } catch {
          /* skip unreadable */
        }
      }
      return results;
    },
  };

  // 建议 #1：本地密钥仅落本机 userData 目录（不写入会随账号同步的 utools.db）。
  const LOCAL_SECRETS_PATH = path.join(
    getLocalDataDir(),
    "goose-note-local-secrets.json",
  );
  const SECRET_KEYS = [
    "customOpenAIResponsesApiKey",
    "customOpenAIApiKey",
    "customClaudeApiKey",
    "tinyfishApiKey",
    "webdavPassword",
  ];
  const normalizeSecretsPayload = (raw) => {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const key of SECRET_KEYS) {
      if (typeof raw[key] === "string" && raw[key].length > 0) {
        out[key] = raw[key];
      }
    }
    return out;
  };
  window.gooseLocalSecrets = {
    read: () => {
      try {
        if (!fs.existsSync(LOCAL_SECRETS_PATH)) return {};
        const parsed = JSON.parse(fs.readFileSync(LOCAL_SECRETS_PATH, "utf-8"));
        return normalizeSecretsPayload(parsed);
      } catch {
        return {};
      }
    },
    write: (secrets) => {
      try {
        const sanitized = normalizeSecretsPayload(secrets);
        fs.mkdirSync(path.dirname(LOCAL_SECRETS_PATH), { recursive: true });
        fs.writeFileSync(LOCAL_SECRETS_PATH, JSON.stringify(sanitized, null, 2), {
          encoding: "utf-8",
          mode: 0o600,
        });
        return true;
      } catch {
        return false;
      }
    },
  };

  const waitPrintDocumentReady = async (webContents, timeoutMs = 8000) => {
    if (!webContents || typeof webContents.executeJavaScript !== "function") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const ready = await webContents.executeJavaScript(
          "Boolean(window.__GOOSE_PRINT_READY__ === true)",
        );
        if (ready) return;
      } catch {
        /* 导航中 */
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };

  const printHtmlToPdf = async (html) => {
    if (typeof html !== "string" || !html.trim()) return null;
    if (typeof utools?.createBrowserWindow !== "function") return null;

    const htmlPath = path.join(os.tmpdir(), "goose-note-print", `print-${Date.now()}.html`);
    await fs.promises.mkdir(path.dirname(htmlPath), { recursive: true });
    await fs.promises.writeFile(htmlPath, html, "utf8");
    const fileUrl = pathToFileURL(htmlPath).href;

    try {
      return await new Promise((resolve, reject) => {
        let settled = false;
        let win = null;
        let openedWithFileUrl = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          try {
            win?.close?.();
          } catch {}
          if (error) reject(error);
          else resolve(value);
        };

        const injectHtml = async (webContents) => {
          if (typeof webContents?.executeJavaScript !== "function") return;
          await webContents.executeJavaScript(
            `document.open();document.write(${JSON.stringify(html)});document.close();true;`,
          );
        };

        const runPrint = async () => {
          try {
            const webContents = win?.webContents;
            if (typeof webContents?.printToPDF !== "function") {
              finish(null, null);
              return;
            }
            if (!openedWithFileUrl) {
              try {
                if (typeof webContents.loadURL === "function") {
                  await webContents.loadURL(fileUrl);
                } else if (typeof win?.loadURL === "function") {
                  await win.loadURL(fileUrl);
                } else {
                  await injectHtml(webContents);
                }
              } catch {
                await injectHtml(webContents);
              }
            }
            await waitPrintDocumentReady(webContents);
            const data = await webContents.printToPDF({
              printBackground: true,
              preferCSSPageSize: true,
            });
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
            if (!buf.length) {
              finish(new Error("printToPDF 返回空内容"));
              return;
            }
            finish(null, buf.toString("base64"));
          } catch (error) {
            finish(error);
          }
        };

        const openWindow = (url) =>
          utools.createBrowserWindow(
            url,
            { show: false, width: 820, height: 1169, hasShadow: false },
            () => {
              void runPrint();
            },
          );

        try {
          openedWithFileUrl = false;
          win = openWindow("print-pdf.html");
        } catch {
          try {
            openedWithFileUrl = true;
            win = openWindow(fileUrl);
          } catch (fallbackError) {
            finish(fallbackError);
            return;
          }
        }

        setTimeout(() => finish(new Error("printToPDF 超时")), 20000);
      });
    } finally {
      try {
        await fs.promises.unlink(htmlPath);
      } catch {}
    }
  };

  // 本地文件系统 API 桥接（仅用于本地文件夹模式）
  window.gooseFs = {
    fetchRemoteImage,
    selectDirectory: async () => {
      if (typeof utools?.showOpenDialog !== "function") {
        throw new Error("当前环境无法选择本地文件夹");
      }
      const paths = await Promise.resolve(
        utools.showOpenDialog({
          title: "打开文件夹",
          properties: ["openDirectory", "createDirectory"],
        }),
      );
      const selected =
        Array.isArray(paths) && typeof paths[0] === "string" ? paths[0] : null;
      if (selected) {
        addMountedRoot(selected);
      }
      return selected;
    },

    readDir: (dir) => {
      const safeDir = resolveSafePath(dir);
      if (!safeDir) return [];
      try {
        return fs.readdirSync(safeDir, { withFileTypes: true }).map((entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
          path: path.join(safeDir, entry.name),
        }));
      } catch (err) {
        console.error("[gooseFs] readDir failed:", err);
        return [];
      }
    },

    readDirAsync: async (dir) => {
      const safeDir = resolveSafePath(dir);
      if (!safeDir) return [];
      try {
        const entries = await fs.promises.readdir(safeDir, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
          path: path.join(safeDir, entry.name),
        }));
      } catch (err) {
        console.error("[gooseFs] readDirAsync failed:", err);
        return [];
      }
    },

    readFile: (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return null;
      try {
        return fs.readFileSync(safePath, "utf-8");
      } catch (err) {
        console.error("[gooseFs] readFile failed:", err);
        return null;
      }
    },

    readFileAsync: async (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return null;
      try {
        return await fs.promises.readFile(safePath, "utf-8");
      } catch (err) {
        console.error("[gooseFs] readFileAsync failed:", err);
        return null;
      }
    },

    readFileStatAsync: async (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) {
        return { ok: false, error: "路径不在已挂载文件夹内", content: null };
      }
      try {
        const content = await fs.promises.readFile(safePath, "utf-8");
        return { ok: true, content };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error("[gooseFs] readFileStatAsync failed:", err);
        return { ok: false, error, content: null };
      }
    },

    // 仅返回 mtimeMs + size（不含 atime），供渲染进程指纹快路径使用。
    statAsync: async (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return null;
      try {
        const st = await fs.promises.stat(safePath);
        return { mtimeMs: st.mtimeMs, size: st.size };
      } catch (err) {
        console.error("[gooseFs] statAsync failed:", err);
        return null;
      }
    },

    readFileBase64: (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return null;
      try {
        return fs.readFileSync(safePath).toString("base64");
      } catch (err) {
        console.error("[gooseFs] readFileBase64 failed:", err);
        return null;
      }
    },

    writeFile: (filePath, content, encoding = "utf-8") => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return false;
      // 必须在写入前登记：fs.watch 的回调可能在 writeFile/writeFileAsync 尚未返回时
      // 先触发。若等写完再标记，前端会把自己的自动保存误判成外部修改并重载编辑器。
      const markedAt = Date.now();
      recentWrites.set(safePath, markedAt);
      try {
        fs.writeFileSync(safePath, content, resolveWriteEncoding(encoding));
        // 写入结束后续期，覆盖文件系统延迟派发 watch 事件的情况。
        markRecentWrite(safePath);
        invalidateLocalNotebookCache();
        return true;
      } catch (err) {
        if (recentWrites.get(safePath) === markedAt) {
          recentWrites.delete(safePath);
        }
        console.error("[gooseFs] writeFile failed:", err);
        return false;
      }
    },

    writeFileAsync: async (filePath, content, encoding = "utf-8") => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return false;
      const markedAt = Date.now();
      recentWrites.set(safePath, markedAt);
      try {
        await fs.promises.writeFile(
          safePath,
          content,
          resolveWriteEncoding(encoding),
        );
        markRecentWrite(safePath);
        invalidateLocalNotebookCache();
        return true;
      } catch (err) {
        if (recentWrites.get(safePath) === markedAt) {
          recentWrites.delete(safePath);
        }
        console.error("[gooseFs] writeFileAsync failed:", err);
        return false;
      }
    },

    exists: (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return false;
      try {
        return fs.existsSync(safePath);
      } catch (err) {
        console.error("[gooseFs] exists failed:", err);
        return false;
      }
    },

    existsAsync: async (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return false;
      try {
        await fs.promises.access(safePath);
        return true;
      } catch {
        return false;
      }
    },

    realpathAsync: async (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return null;
      try {
        return await fs.promises.realpath(safePath);
      } catch {
        return null;
      }
    },

    watch: (dirPath, callback) => {
      const safeDir = resolveSafePath(dirPath);
      if (!safeDir) return null;
      try {
        // 如果已经存在监听器，先停止
        if (watchers.has(safeDir)) {
          watchers.get(safeDir).close();
        }

        const watcher = fs.watch(
          safeDir,
          { recursive: true },
          (eventType, filename) => {
            if (filename) {
              const fullPath = path.resolve(safeDir, String(filename));
              // 检查是否为最近写入的文件，避免误触发重载提示
              const now = Date.now();
              let skip = false;
              for (const [key, time] of recentWrites) {
                if (now - time >= RECENT_WRITE_WINDOW_MS) {
                  recentWrites.delete(key);
                  continue;
                }
                const normalizedKey = path.resolve(key);
                if (
                  fullPath === normalizedKey ||
                  fullPath.startsWith(`${normalizedKey}${path.sep}`)
                ) {
                  skip = true;
                  break;
                }
              }
              if (skip) return; // 跳过自己写入/删除的文件
              if (shouldIgnoreWatchFilename(String(filename))) return;

              // 通知前端有文件变更
              window.dispatchEvent(
                new CustomEvent("goose-note:file-changed", {
                  detail: { eventType, filename, dirPath: safeDir },
                }),
              );
            }
          },
        );

        watchers.set(safeDir, watcher);
        return watcher;
      } catch (err) {
        console.error("[gooseFs] watch failed:", err);
        return null;
      }
    },

    unwatch: (dirPath) => {
      const safeDir = resolveSafePath(dirPath) || dirPath;
      const watcher = watchers.get(safeDir);
      if (watcher) {
        watcher.close();
        watchers.delete(safeDir);
      }
    },

    mkdir: (dirPath) => {
      const safeDir = resolveSafePath(dirPath);
      if (!safeDir) return false;
      try {
        fs.mkdirSync(safeDir, { recursive: true });
        markRecentWrite(`${safeDir}${path.sep}`);
        invalidateLocalNotebookCache();
        return true;
      } catch (err) {
        console.error("[gooseFs] mkdir failed:", err);
        return false;
      }
    },

    deleteFile: async (filePath) => {
      const safePath = resolveSafePath(filePath);
      if (!safePath) return false;
      try {
        const ok = await tryTrash(safePath);
        if (ok) {
          markRecentWrite(safePath);
          invalidateLocalNotebookCache();
        }
        return ok;
      } catch (err) {
        console.error("[gooseFs] deleteFile failed:", err);
        return false;
      }
    },

    restoreFromTrash: async (destPath) => {
      const safeDest = resolveSafePath(destPath);
      if (!safeDest) return false;
      return restoreFromTrash(safeDest);
    },

    deleteDir: async (dirPath) => {
      const safeDir = resolveSafePath(dirPath);
      if (!safeDir) return false;
      try {
        const ok = await tryTrash(safeDir);
        if (ok) {
          markRecentWrite(`${safeDir}${path.sep}`);
          invalidateLocalNotebookCache();
        }
        return ok;
      } catch (err) {
        console.error("[gooseFs] deleteDir failed:", err);
        return false;
      }
    },

    rename: (oldPath, newPath) => {
      const safeOld = resolveSafePath(oldPath);
      const safeNew = resolveSafePath(newPath);
      if (!safeOld || !safeNew) return false;
      try {
        fs.renameSync(safeOld, safeNew);
        markRecentWrite(safeOld);
        markRecentWrite(safeNew);
        invalidateLocalNotebookCache();
        return true;
      } catch (err) {
        console.error("[gooseFs] rename failed:", err);
        return false;
      }
    },

    writeTempFile: async (relativePath, contentBase64) => {
      try {
        const targetPath = resolveTempTargetPath(relativePath);
        const targetDir = path.dirname(targetPath);
        await fs.promises.mkdir(targetDir, { recursive: true });

        const expectedSize = getBase64ByteLength(contentBase64);
        try {
          const existingStat = await fs.promises.stat(targetPath);
          if (existingStat.isFile() && existingStat.size === expectedSize) {
            const now = new Date();
            await fs.promises.utimes(targetPath, now, now);
            return targetPath;
          }
        } catch {}

        await fs.promises.writeFile(targetPath, contentBase64, "base64");
        return targetPath;
      } catch (err) {
        console.error("[gooseFs] writeTempFile failed:", err);
        return null;
      }
    },

    printHtmlToPdf: async (html) => {
      try {
        return await printHtmlToPdf(html);
      } catch (err) {
        console.error("[gooseFs] printHtmlToPdf failed:", err);
        return null;
      }
    },

    cleanupTempFiles: async (prefix, maxAgeMs) => {
      try {
        const basePath = resolveTempTargetPath(prefix);
        const cutoff = Date.now() - Number(maxAgeMs || 0);
        if (!Number.isFinite(cutoff)) return;
        await removeExpiredEntries(basePath, cutoff);
      } catch (err) {
        console.error("[gooseFs] cleanupTempFiles failed:", err);
      }
    },

    revealItemInFolder,
    listAvailableOpenApps,

    openWithApp,
    openTerminalAtPath,
  };

  window.gooseWeb = {
    fetchText: (url) => fetchPublicText(url),
  };

  const ERROR_REPORTING_PATH = path.join(
    os.homedir(),
    ".config",
    "goose",
    "error-reporting.json",
  );

  // 不在启动时自动创建 ~/.config/goose/error-reporting.json；仅当文件已存在时读取。
  const readErrorReportingFile = () => {
    try {
      if (!fs.existsSync(ERROR_REPORTING_PATH)) return null;
      return JSON.parse(fs.readFileSync(ERROR_REPORTING_PATH, "utf-8"));
    } catch (error) {
      console.warn("[goose-note] read error-reporting.json failed:", error);
      return null;
    }
  };

  const resolveErrorReportingTarget = () => {
    const raw = readErrorReportingFile();
    if (!raw || typeof raw !== "object") return null;
    const projectEntry = raw.projects && typeof raw.projects === "object"
      ? raw.projects["goose-note"]
      : null;
    let dsn = null;
    let enabled = raw.enabled === true;
    if (typeof projectEntry === "string" && projectEntry.trim()) {
      dsn = projectEntry.trim();
    } else if (projectEntry && typeof projectEntry === "object") {
      if (typeof projectEntry.dsn === "string" && projectEntry.dsn.trim()) {
        dsn = projectEntry.dsn.trim();
      }
      if (typeof projectEntry.enabled === "boolean") {
        enabled = projectEntry.enabled;
      }
    }
    if (!enabled || !dsn) return null;
    try {
      const parsed = new NodeURL(dsn);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      const publicKey = parsed.username;
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const projectId = pathParts.pop();
      if (!publicKey || !projectId) return null;
      const basePath = pathParts.length > 0 ? `/${pathParts.join("/")}` : "";
      const endpoint = `${parsed.protocol}//${parsed.host}${basePath}/api/${projectId}/envelope/`;
      const environment =
        typeof raw.environment === "string" && raw.environment.trim()
          ? raw.environment.trim()
          : "dev";
      return { endpoint, dsn, publicKey, environment };
    } catch {
      return null;
    }
  };

  const sanitizeReportValue = (value, depth = 0) => {
    if (depth > 4 || value == null) return undefined;
    if (typeof value === "string") return value.slice(0, 2000);
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) {
      return value
        .slice(0, 20)
        .map((item) => sanitizeReportValue(item, depth + 1))
        .filter((item) => item !== undefined);
    }
    if (typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value).slice(0, 30)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        const sanitized = sanitizeReportValue(v, depth + 1);
        if (sanitized !== undefined) out[k] = sanitized;
      }
      return out;
    }
    return undefined;
  };

  const sendWhitelistedSentryEvent = (payload) =>
    new Promise((resolve) => {
      try {
        const target = resolveErrorReportingTarget();
        if (!target || !payload || typeof payload !== "object") {
          resolve({ statusCode: 0 });
          return;
        }
        const eventBody = {
          event_id:
            typeof payload.event_id === "string"
              ? payload.event_id.slice(0, 64)
              : undefined,
          timestamp:
            typeof payload.timestamp === "number" ||
            typeof payload.timestamp === "string"
              ? payload.timestamp
              : Date.now() / 1000,
          level:
            typeof payload.level === "string"
              ? payload.level.slice(0, 16)
              : "error",
          environment: target.environment,
          release:
            typeof payload.release === "string"
              ? payload.release.slice(0, 128)
              : undefined,
          message:
            typeof payload.message === "string"
              ? payload.message.slice(0, 2000)
              : undefined,
          exception: sanitizeReportValue(payload.exception),
          tags: sanitizeReportValue(payload.tags),
          extra: sanitizeReportValue(payload.extra),
        };
        const eventJson = JSON.stringify(eventBody);
        const envelopeHeader = JSON.stringify({
          event_id: eventBody.event_id,
          dsn: target.dsn,
        });
        const itemHeader = JSON.stringify({
          type: "event",
          length: Buffer.byteLength(eventJson, "utf-8"),
        });
        const envelopeBuffer = Buffer.from(
          `${envelopeHeader}\n${itemHeader}\n${eventJson}\n`,
          "utf-8",
        );

        const parsed = new NodeURL(target.endpoint);
        const lib = parsed.protocol === "https:" ? https : http;
        const req = lib.request(
          {
            method: "POST",
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
            path: parsed.pathname + parsed.search,
            headers: {
              "Content-Type": "application/x-sentry-envelope",
              "Content-Length": String(envelopeBuffer.length),
              "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.publicKey}`,
            },
          },
          (res) => {
            res.resume();
            resolve({ statusCode: res.statusCode || 0 });
          },
        );
        req.on("error", () => resolve({ statusCode: 0 }));
        req.end(envelopeBuffer);
      } catch {
        resolve({ statusCode: 0 });
      }
    });

  window.gooseErrorReporting = {
    readConfig: () => readErrorReportingFile(),
    reportEvent: (payload) => sendWhitelistedSentryEvent(payload),
  };


  const MCP_TOOL_REQUEST_EVENT = "goose-note:mcp-tool-request";
  const MCP_TOOL_RESPONSE_EVENT = "goose-note:mcp-tool-response";
  const MCP_TOOL_READY_EVENT = "goose-note:mcp-tool-ready";
  const MCP_TOOL_READY_TIMEOUT_MS = 15000;
  const MCP_TOOL_EXEC_TIMEOUT_MS = 30000;
  const MCP_WRITE_TOOL_NAMES = [
    "create_note",
    "append_note",
    "update_note",
    "rename_note",
    "delete_note",
    "restore_note",
    "create_notebook",
    "update_notebook",
    "delete_notebook",
  ];
  const MCP_TOOL_CAPABILITIES = {
    protocol: "utools-mcp-tools",
    version: "1.0",
    transport: "uTools plugin.json.tools + utools.registerTool",
    tools: [
      "list_notebooks",
      "list_notes",
      "search_notes",
      "get_note",
      "get_mcp_capabilities",
      ...MCP_WRITE_TOOL_NAMES,
    ],
    writeSafety:
      "写入工具直接修改本地笔记库；调用方应在执行前取得用户确认。删除进入回收站，不是永久删除。",
  };

  window.__gooseNoteMcpReady = false;
  const pendingMcpRequests = new Map();
  const buildMcpRequestId = () =>
    `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeToolParams = (params) => {
    const sanitize = (value, depth = 0) => {
      if (depth > 6 || value == null) return null;
      if (typeof value === "string") return value.slice(0, 10000);
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
      if (typeof value !== "object") return null;

      const safe = {};
      for (const [key, item] of Object.entries(value).slice(0, 100)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        safe[key] = sanitize(item, depth + 1);
      }
      return safe;
    };

    if (!params || typeof params !== "object" || Array.isArray(params)) return {};
    return sanitize(params);
  };

  const waitForMcpBridgeReady = (timeoutMs = MCP_TOOL_READY_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
      if (window.__gooseNoteMcpReady) {
        resolve();
        return;
      }

      let settled = false;
      const cleanup = () => {
        window.removeEventListener(MCP_TOOL_READY_EVENT, handleReady);
        clearTimeout(timer);
      };
      const handleReady = () => {
        if (settled) return;
        settled = true;
        window.__gooseNoteMcpReady = true;
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("笔记 MCP 桥接尚未就绪，请先打开插件页面完成初始化"));
      }, timeoutMs);
      window.addEventListener(MCP_TOOL_READY_EVENT, handleReady, { once: true });
    });

  const invokeRendererMcpTool = async (
    toolName,
    params,
    timeoutMs = MCP_TOOL_EXEC_TIMEOUT_MS,
  ) => {
    await waitForMcpBridgeReady();
    return new Promise((resolve, reject) => {
      const requestId = buildMcpRequestId();
      const timer = setTimeout(() => {
        pendingMcpRequests.delete(requestId);
        reject(new Error(`工具 ${toolName} 执行超时`));
      }, timeoutMs);
      pendingMcpRequests.set(requestId, { resolve, reject, timer });
      window.dispatchEvent(
        new CustomEvent(MCP_TOOL_REQUEST_EVENT, {
          detail: {
            requestId,
            tool: toolName,
            params: normalizeToolParams(params),
          },
        }),
      );
    });
  };

  window.addEventListener(MCP_TOOL_READY_EVENT, () => {
    window.__gooseNoteMcpReady = true;
  });

  window.addEventListener(MCP_TOOL_RESPONSE_EVENT, (event) => {
    const detail = event.detail || {};
    const requestId = detail.requestId;
    if (!requestId || !pendingMcpRequests.has(requestId)) return;
    const pending = pendingMcpRequests.get(requestId);
    pendingMcpRequests.delete(requestId);
    clearTimeout(pending.timer);
    if (detail.ok) {
      pending.resolve(detail.result);
      return;
    }
    pending.reject(new Error(detail.error || "工具执行失败"));
  });

  const registerMcpWriteTools = () => {
    if (typeof utools?.registerTool !== "function") return;

    registerReadonlyMcpTool("get_mcp_capabilities", async () => MCP_TOOL_CAPABILITIES);

    MCP_WRITE_TOOL_NAMES.forEach((toolName) => {
      utools.registerTool(toolName, async (params, context) => {
        const reportProgress = (progress, message) => {
          try {
            const reported = context?.sendProgress?.({ progress, total: 1, message });
            if (reported && typeof reported.catch === "function") reported.catch(() => {});
          } catch {}
        };
        reportProgress(0, `正在执行 ${toolName}`);
        const result = await invokeRendererMcpTool(toolName, params);
        reportProgress(1, `${toolName} 执行完成`);
        return result;
      });
    });
  };

  registerMcpTools();
  registerMcpWriteTools();


  // 处理 uTools 全局搜索（sublist）点击
  // 注意：sublist API 可能不是所有 uTools 版本都支持
  if (typeof utools.onSublistEnter === "function") {
    utools.onSublistEnter((item) => {
      const pageId = item.url.replace("goose-note://page/", "");

      // 通知应用切换页面
      window.dispatchEvent(
        new CustomEvent("goose-note:navigate", {
          detail: { pageId },
        }),
      );
    });
  }

  const dispatchOpenFolder = (folderPath) => {
    window[PENDING_OPEN_FOLDER_KEY] = folderPath;
    window.dispatchEvent(
      new CustomEvent("goose-note:open-folder", {
        detail: { path: folderPath },
      }),
    );
  };

  const PENDING_OPEN_MARKDOWN_KEY = "__gooseNotePendingOpenMarkdown";
  const dispatchOpenMarkdown = (filePath) => {
    window[PENDING_OPEN_MARKDOWN_KEY] = filePath;
    window.dispatchEvent(
      new CustomEvent("goose-note:open-markdown", {
        detail: { path: filePath },
      }),
    );
  };

  const clearSubInput = () => {
    if (typeof utools.removeSubInput === "function") {
      utools.removeSubInput();
    }
  };

  // 快捷键再按一次关闭：对齐小窗 quickNoteVisible。分离窗口 hideMainWindow 无效，
  // 必须 outPlugin(false) 才能收起到后台。
  let pluginVisible = false;

  // 只删除本插件写在临时目录里的速记文件，避免文件匹配误删用户自己的同后缀文件。
  const isQuickNoteTempFile = (filePath) => {
    try {
      const root = fs.realpathSync(path.join(os.tmpdir(), "goose-quicknote"));
      const resolved = fs.realpathSync(filePath);
      const relative = path.relative(root, resolved);
      return (
        Boolean(relative) &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        resolved.toLowerCase().endsWith(".goosequicknote")
      );
    } catch {
      return false;
    }
  };

  // 主插件指令处理。速记小窗已拆为独立插件「鹅的小窗」（quicknote-plugin.json），
  // 主插件不再开内置浮窗，故此处不再有 quicknote_new/quicknote_last 分支。
  utools.onPluginEnter(({ code, type, payload, optional, from }) => {
    if (
      shouldHideOnHotkeyRetrigger({
        code,
        from,
        pluginVisible,
      })
    ) {
      pluginVisible = false;
      hidePluginToBackground(utools);
      return;
    }

    pluginVisible = true;
    if (typeof code === "string" && code) {
      window.__gooseLastEnterCode = code;
    }

    // 普通进入插件时不要挂 uTools 宿主输入框。应用内已有 CommandPalette；
    // 宿主 subInput 会抢走编辑器焦点，导致正文输入跑到窗口左侧。
    clearSubInput();

    window.dispatchEvent(
      new CustomEvent("goose-note:plugin-enter", {
        detail: { code, type, payload, optional, from },
      }),
    );

    if (code === "open_folder") {
      if ((type === "files" || type === "file") && payload && payload.length > 0) {
        const targetPath = payload[0]?.path;
        if (targetPath) {
          try {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
              addMountedRoot(targetPath);
              dispatchOpenFolder(targetPath);
            } else if (stat.isFile() && /\.(md|markdown)$/i.test(targetPath)) {
              addMountedRoot(path.dirname(targetPath));
              dispatchOpenMarkdown(targetPath);
            }
          } catch (err) {
            console.error("[gooseFs] stat failed:", err);
          }
        }
      }
      return;
    }

    if (code === "new_page") {
      // over 类型：payload 通常为选中纯文本字符串；做 string/array 双兜底。
      const selectedText =
        typeof payload === "string"
          ? payload
          : (Array.isArray(payload) &&
              (payload[0]?.data || payload[0]?.text)) ||
            "";
      window.dispatchEvent(
        new CustomEvent("goose-note:new-page", {
          detail: { text: selectedText },
        }),
      );
      return;
    }

    if (code === "quicknote_save") {
      // B 插件把 blocks JSON 写成 .goosequicknote，再用文件匹配 redirect 过来。
      // onPluginEnter 的 files payload 是 [{ path, ... }]，不是 redirect 时的 { type, data }。
      // 读到并解析成功、推进收件箱之后才删临时文件。读或解析失败留下文件，
      // 让小窗轮询超时后自行删除并保留草稿。落库在 React 侧，可能晚于 8 秒轮询，
      // 所以不把删除推迟到 main.tsx，避免慢启动被误判失败后又把收件箱内容落库。
      const filePath =
        (type === "files" || type === "file") && Array.isArray(payload)
          ? payload[0] && payload[0].path
          : null;
      if (typeof filePath === "string" && filePath) {
        let blocksJson = null;
        try {
          blocksJson = fs.readFileSync(filePath, "utf8");
        } catch (err) {
          console.error("[quicknote_save] 读取入库文件失败", err);
        }
        let parsed = null;
        if (typeof blocksJson === "string" && blocksJson.trim()) {
          try {
            parsed = JSON.parse(blocksJson);
          } catch (err) {
            console.error("[quicknote_save] 解析入库文件失败", err);
          }
        }
        if (parsed !== null && typeof parsed === "object") {
          // 暂存到全局收件箱，支持冷启动（React 未 mount）时不丢数据。
          if (!Array.isArray(window.__gooseQuickNoteInbox)) {
            window.__gooseQuickNoteInbox = [];
          }
          window.__gooseQuickNoteInbox.push(blocksJson);
          // 标记本次是被 redirect 唤起（用于 React 侧判断是否 outPlugin）。
          window.__gooseQuickNoteRedirectWoke = true;
          // 通知已 mount 的 React 立即消费。
          window.dispatchEvent(new CustomEvent("goose-note:quicknote-inbox"));
          if (isQuickNoteTempFile(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error("[quicknote_save] 删除临时文件失败", err);
            }
          }
        }
      }
      return;
    }
  });

  if (typeof utools.onPluginOut === "function") {
    utools.onPluginOut((isKill) => {
      pluginVisible = false;
      clearSubInput();
      window.dispatchEvent(
        new CustomEvent("goose-note:plugin-out", {
          detail: {
            // isKill=true 表示插件进程被销毁，false 表示仅隐藏到后台。
            isKill: isKill === true,
          },
        }),
      );
    });
  }

}
