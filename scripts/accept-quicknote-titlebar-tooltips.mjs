// Run: ego-browser nodejs < scripts/accept-quicknote-titlebar-tooltips.mjs
// Isolated quicknote dev entry; do not edit or persist a user's notes.
const task = await taskSpace("goose-quicknote-titlebar-tooltips");
const page = task.page("p1");
const results = [];
try {
  await page.cdp("egoAutomated.disable");
  await page.cdp("Runtime.enable");
  await page.goto("http://127.0.0.1:4179/quicknote.html");
  await page.waitForSelector('loc=css:.quicknote-titlebar-actions button[aria-label="使用说明"]', { state: "visible" });
  const cases = [
    { label: "把当前便签存到鹅的笔记", text: "存到笔记" },
    { label: "使用说明", text: "使用说明" },
    { label: "关闭", text: "收起小窗" },
  ];
  const visible = await page.evaluate(() =>
    [...document.querySelectorAll(".quicknote-titlebar-actions button")].map((button) => button.getAttribute("aria-label")),
  );
  for (const { label, text } of cases) {
    if (!visible.includes(label)) {
      results.push({ label, result: "未验收：浏览器入口无 uTools 专属保存能力" });
      continue;
    }
    await page.hover(`loc=css:.quicknote-titlebar-actions button[aria-label="${label}"]`, { label: `悬停${label}图标` });
    await page.waitForFunction((expected) =>
      [...document.querySelectorAll('[role="tooltip"]')].some((node) => node.textContent?.includes(expected)),
    text, { timeout: 2500 });
    results.push({ label, result: "通过", expected: text });
  }
  await page.click('loc=css:.quicknote-titlebar-actions button[aria-label="使用说明"]', { label: "打开使用说明" });
  await page.waitForSelector('loc=css:.quicknote-help-popover', { state: "visible" });
  results.push({ action: "点击使用说明", result: "通过" });
  console.log(JSON.stringify({ entry: "quicknote.html", results, errors: (await page.events()).filter((event) => /exception|console/i.test(event.type ?? "")) }));
  await task.finish({ keep: [] });
} catch (error) {
  console.log(JSON.stringify({ entry: "quicknote.html", results, failure: String(error), snapshot: await page.snapshot() }));
  throw error;
}
