const name = process.argv[2];

if (!name) {
  console.error("✗ 缺少验证名。用法: bun run verify <name>");
  process.exit(1);
}

const known = new Set(["settings-open", "heading-blocks"]);
if (!known.has(name)) {
  console.error(`✗ 未知验证: ${name}`);
  process.exit(1);
}

const { run } = await import(`./verify/${name}.ts`);
process.exit(await run());
