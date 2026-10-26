import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const baselineFile = path.resolve("scripts/utools-size-baseline.json");
const threshold = Number(process.env.UTOOLS_SIZE_THRESHOLD ?? "0.03");
const shouldUpdateBaseline = process.argv.includes("--update");

const toPosix = (value) => value.split(path.sep).join("/");

// .map 是调试 sourcemap。正式构建会删掉它们，不进插件包；不要写进体积基线。
const isIgnoredFile = (name) => name.startsWith(".") || name.endsWith(".map");

const collectSize = (dirPath) => {
  const files = {};
  let total = 0;

  const walk = (targetDir) => {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (isIgnoredFile(entry.name)) continue;

      const fullPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const stat = fs.statSync(fullPath);
      const relativePath = toPosix(path.relative(dirPath, fullPath));
      files[relativePath] = stat.size;
      total += stat.size;
    }
  };

  walk(dirPath);
  return { total, files };
};

const serializeBaseline = (snapshot) => {
  const files = Object.fromEntries(
    Object.entries(snapshot.files).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
  return `${JSON.stringify({ total: snapshot.total, files }, null, 2)}\n`;
};

if (!fs.existsSync(distDir)) {
  console.error("❌ 未找到 dist 目录，请先执行构建。");
  process.exit(1);
}

const current = collectSize(distDir);

if (shouldUpdateBaseline) {
  fs.writeFileSync(baselineFile, serializeBaseline(current));
  console.log(`✅ 已更新体积基线: ${baselineFile}`);
  process.exit(0);
}

if (!fs.existsSync(baselineFile)) {
  fs.writeFileSync(baselineFile, serializeBaseline(current));
  console.log("ℹ️ 未找到体积基线，已自动创建基线文件。");
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf-8"));
const baselineTotal = Number(baseline.total || 0);

if (!baselineTotal) {
  console.error("❌ 体积基线无效，请执行 `node scripts/check-utools-size.js --update`。");
  process.exit(1);
}

const baselinePaths = Object.keys(baseline.files && typeof baseline.files === "object" ? baseline.files : {});
const missingPaths = baselinePaths.filter((file) => current.files[file] == null);
if (baselinePaths.length > 0 && missingPaths.length * 2 > baselinePaths.length) {
  console.error(
    `❌ baseline layout changed, run --update（${missingPaths.length}/${baselinePaths.length} 个基线文件不在当前产物中，增长百分比不可比）`,
  );
  console.error("   请执行 `node scripts/check-utools-size.js --update`。");
  process.exit(1);
}

const growthBytes = current.total - baselineTotal;
const growthRate = growthBytes / baselineTotal;
const growthPercent = (growthRate * 100).toFixed(2);

const deltas = Object.entries(current.files)
  .map(([file, size]) => {
    const previousSize = Number(baseline.files?.[file] || 0);
    return { file, delta: size - previousSize, size };
  })
  .filter((item) => item.delta > 0)
  .sort((a, b) => b.delta - a.delta)
  .slice(0, 8);

if (growthRate > threshold) {
  console.error(
    `❌ uTools 产物体积增长超阈值：${growthPercent}%（阈值 ${(threshold * 100).toFixed(2)}%）`,
  );
  console.error(
    `   基线: ${(baselineTotal / 1024 / 1024).toFixed(2)} MB, 当前: ${(current.total / 1024 / 1024).toFixed(2)} MB`,
  );

  if (deltas.length > 0) {
    console.error("   体积增长最大的文件：");
    deltas.forEach((item) => {
      console.error(
        `   - ${item.file}: +${(item.delta / 1024).toFixed(1)} KB (当前 ${(item.size / 1024).toFixed(1)} KB)`,
      );
    });
  }
  process.exit(1);
}

console.log(
  `✅ uTools 体积检查通过：${growthPercent}%（阈值 ${(threshold * 100).toFixed(2)}%）`,
);
