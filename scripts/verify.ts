const name = process.argv[2];

if (!name) {
  console.error("✗ 缺少验证名。用法: bun run verify <name>");
  process.exit(1);
}

if (name !== "settings-open") {
  console.error(`✗ 未知验证: ${name}`);
  process.exit(1);
}

const { run } = await import("./verify/settings-open.ts");
process.exit(await run());
