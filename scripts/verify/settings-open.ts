import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { commitPendingEditorChange } from "../../src/components/editor/core/editorPendingCommit.ts";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function quote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function probeCommandSync(command: string) {
  try {
    const result = spawnSync("/bin/zsh", ["-lc", `command -v ${quote(command)}`], {
      timeout: 1000,
      stdio: "ignore",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function probeCommandAsync(command: string) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (exists: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(exists);
    };
    let child;
    try {
      child = spawn("/bin/zsh", ["-lc", `command -v ${quote(command)}`], {
        stdio: "ignore",
      });
    } catch {
      finish(false);
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // already exited
      }
      finish(false);
    }, 1000);
    child.on("error", () => finish(false));
    child.on("close", (code) => finish(code === 0));
  });
}

function parseOpenAppCandidates(source: string) {
  const blocks = [...source.matchAll(/\{[\s\S]*?kind:\s*"([^"]+)"\s*,?\s*\}/g)];
  return blocks.map((match) => {
    const block = match[0];
    const commandMatch = /commands:\s*\[([^\]]*)\]/.exec(block);
    const commands = commandMatch
      ? [...commandMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])
      : [];
    const aliasMatch = /aliases:\s*\[([^\]]*)\]/.exec(block);
    const aliases = aliasMatch
      ? [...aliasMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])
      : [];
    const appName = /appName:\s*"([^"]+)"/.exec(block)?.[1] ?? "";
    return { appName, commands, aliases };
  });
}

/** 打开设置时旧路径会对全部候选做同步 command -v。这里复现那次主线程占用。 */
function measureLegacySettingsProbe(candidates: Array<{ appName: string; commands: string[]; aliases: string[] }>) {
  const seen = new Set<string>();
  let calls = 0;
  const started = performance.now();
  for (const candidate of candidates) {
    for (const command of candidate.commands) {
      if (seen.has(command)) continue;
      seen.add(command);
      calls += 1;
      probeCommandSync(command);
    }
    if (process.platform !== "darwin" && candidate.appName && !seen.has(candidate.appName)) {
      seen.add(candidate.appName);
      calls += 1;
      probeCommandSync(candidate.appName);
    }
  }
  return {
    calls,
    wallMs: Math.round(performance.now() - started),
  };
}

async function measureAsyncProbeYield() {
  let ran = false;
  const pending = Promise.all(
    ["cursor", "code", "zed", "ghostty", "wezterm", "kitty", "alacritty", "subl"].map((command) =>
      probeCommandAsync(command),
    ),
  );
  await new Promise<void>((resolve) => {
    setImmediate(() => {
      ran = true;
      resolve();
    });
  });
  await pending;
  return ran;
}

type HostDoc = { _id: string; _rev?: string; data: unknown };

function installUtoolsDb() {
  const docs = new Map<string, HostDoc>();
  const stats = {
    gets: 0,
    puts: 0,
    putBytes: 0,
    allDocs: 0,
    storageWrites: 0,
    storageWriteBytes: 0,
  };
  const utools = {
    db: {
      put(doc: { _id: string; _rev?: string; data: unknown }) {
        stats.puts += 1;
        const payload = JSON.stringify(doc.data);
        stats.putBytes += payload.length;
        const rev = `${stats.puts}-${payload.length}`;
        docs.set(doc._id, { _id: doc._id, _rev: rev, data: doc.data });
        return { id: doc._id, ok: true, rev };
      },
      get(id: string) {
        stats.gets += 1;
        return docs.get(id) ?? null;
      },
      remove(id: string) {
        docs.delete(id);
        return { id, ok: true };
      },
      allDocs(prefix = "") {
        stats.allDocs += 1;
        return [...docs.values()].filter((doc) => doc._id.startsWith(prefix));
      },
    },
    dbStorage: {
      getItem() {
        return null;
      },
      setItem(_key: string, value: string) {
        stats.storageWrites += 1;
        stats.storageWriteBytes += value.length;
      },
      removeItem() {},
    },
  };
  (globalThis as { window?: { utools: typeof utools } }).window = { utools };
  return { docs, stats };
}

export async function run(): Promise<number> {
  let failed = 0;
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed += 1;
  };

  const dialog = read("src/pages/workspace/components/sidebar/SettingsDialog.tsx");
  const dataPanel = read("src/pages/workspace/components/sidebar/settings/SettingsDataPanel.tsx");
  const preload = read("preload/preload.cjs");
  const commit = read("src/components/editor/core/useEditorContentCommit.ts");
  const appearance = read("src/pages/workspace/components/sidebar/SettingsAppearance.tsx");
  const candidates = parseOpenAppCandidates(read("src/lib/local-folder-open-apps.ts"));
  const fontQueryCount = (dialog + dataPanel + appearance).split("queryLocalFonts").length - 1;
  const pageSubscriptions = [dialog, dataPanel].reduce(
    (count, source) => count + (source.match(/usePages\s*\(/g)?.length ?? 0),
    0,
  );
  const settingsOpenProbes = (dialog.match(/listAvailableOpenApps/g) ?? []).length;

  const legacy = measureLegacySettingsProbe(candidates);
  check(
    "旧路径：打开设置会同步探测全部本机应用候选",
    legacy.calls >= candidates.length && legacy.wallMs >= 0,
    `spawnSync ${legacy.calls} 次，主线程 ${legacy.wallMs}ms`,
  );

  const asyncYields = await measureAsyncProbeYield();
  check(
    "现路径：命令探测改为异步，探测期间事件循环能继续跑",
    asyncYields && !preload.includes("spawnSync"),
    `async probe yielded ${asyncYields}，preload spawnSync ${preload.includes("spawnSync")}`,
  );
  check(
    "打开设置不再发起本机应用探测",
    settingsOpenProbes === 0 && !dialog.includes("prewarmLocalFolderOpenApps"),
    `SettingsDialog listAvailableOpenApps ${settingsOpenProbes}`,
  );
  check(
    "设置对话框不订阅全部页面",
    pageSubscriptions === 0 && !dialog.includes("s.pages") && !dataPanel.includes("usePages()"),
    `usePages( 订阅 ${pageSubscriptions}`,
  );
  check(
    "设置页不枚举本机字体",
    fontQueryCount === 0,
    `queryLocalFonts ${fontQueryCount}`,
  );
  check(
    "卸载保存仍在同一轮同步提交",
    /commitEditorContent\(pageIdForUpdateRef\.current \?\? undefined\);/.test(commit) &&
      !commit.includes("requestIdleCallback") &&
      !commit.includes("setTimeout") &&
      !commit.includes("queueMicrotask"),
  );

  const { docs, stats } = installUtoolsDb();
  const body = "x".repeat(20000);
  for (let index = 0; index < 400; index += 1) {
    docs.set(`gn:page:${index}`, {
      _id: `gn:page:${index}`,
      _rev: "1-seed",
      data: { content: body },
    });
  }
  const libraryBytes = 400 * body.length;
  const { hostRuntime } = await import("../../src/lib/host/runtime.utools.ts");
  stats.puts = 0;
  stats.putBytes = 0;
  stats.gets = 0;
  stats.allDocs = 0;

  const unchanged = commitPendingEditorChange({
    targetPageId: "page",
    currentPageId: "page",
    pending: true,
    content: body,
    signature: "same-body",
    syncedSignature: "same-body",
    commit: () => {
      const current = hostRuntime.db.get<{ content: string }>("gn:page:3");
      hostRuntime.db.put("gn:page:3", { content: `${current?.data.content ?? body}!` }, current?._rev);
    },
  });
  check(
    "正文未变化时打开设置的卸载提交不写 uTools db",
    unchanged === "unchanged" &&
      stats.puts === 0 &&
      stats.putBytes === 0 &&
      stats.gets === 0 &&
      stats.allDocs === 0 &&
      stats.storageWrites === 0,
    `puts ${stats.puts} bytes ${stats.putBytes} gets ${stats.gets} allDocs ${stats.allDocs}`,
  );

  const current = hostRuntime.db.get<{ content: string }>("gn:page:3");
  const changed = commitPendingEditorChange({
    targetPageId: "page",
    currentPageId: "page",
    pending: true,
    content: `${body}!`,
    signature: "edited",
    syncedSignature: "same-body",
    commit: () => {
      hostRuntime.db.put(
        "gn:page:3",
        { content: `${current?.data.content ?? body}!` },
        current?._rev,
      );
    },
  });
  check(
    "正文有变化时只同步写这一篇，不重写整库",
    changed === "committed" &&
      stats.puts === 1 &&
      stats.putBytes < body.length * 2 &&
      stats.putBytes < libraryBytes / 10 &&
      stats.allDocs === 0 &&
      docs.size === 400,
    `puts ${stats.puts} putBytes ${stats.putBytes} libraryBytes ${libraryBytes} docs ${docs.size}`,
  );

  return failed;
}
