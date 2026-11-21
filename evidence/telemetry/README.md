# 匿名遥测接入验收

- 启动：`bunx vite --host 127.0.0.1 --port 4180 --strictPort`
- 入口：`http://127.0.0.1:4180/index.html`（常规工作区）与 `http://127.0.0.1:4180/quicknote.html`（速记小窗）；测试前清理隔离源的 `localStorage`/`sessionStorage`，并通过 `Page.addScriptToEvaluateOnNewDocument` 拦截 `https://feedback-api.cooool.top/api/telemetry` 的 `fetch` / `sendBeacon` 请求（不向线上发包，不动用户真实笔记）。
- 执行：`ego-browser nodejs < scripts/accept-telemetry.mjs | tee evidence/telemetry/run.log`
- 步骤与预期：
  1. 初次打开默认开启统计开关并生成 32 位匿名 `did`；
  2. 点击「查看上报内容」，验证 JSON 含 `enabled: true`、`project: "notes"` 且记录了 `app.open`（`surface: "workspace"`）与 `notebook.count`（`range` 为分桶字符串）；
  3. 关闭开关后立即清除 `did`（`enabled: false, did: null`），刷新页面仍保持关闭；
  4. 关闭状态下查看预览 `pending` 为空，新建页面后 `pending` 仍为空且发出 0 条遥测请求；
  5. 重新开启开关生成新的 32 位 `did`，新建笔记并输入 `ACCEPT_SECRET_TITLE_XYZ` / `ACCEPT_SECRET_BODY_12345`，通过斜杠菜单插入分隔线，校验触发 `note.create`（`source: "sidebar"`）与 `editor.block_insert`（`type: "divider"`）且预览不含标题/正文；
  6. 切到 `quicknote.html` 后校验工作区上报请求体脱敏无泄漏；
  7. 在速记小窗输入 `QUICKNOTE_SECRET_DRAFT_999` 并通过斜杠菜单插入分隔线，切回 `index.html` 后校验收到 `surface: "quicknote"` 的 `app.open` 与 `editor.block_insert` 且不含草稿内容；
  8. 在主设置关闭开关后进入速记小窗并插入分隔线，校验 0 条遥测请求发出。
- 结果：`evidence/telemetry/run.log` 显示 8 步全部通过，`consoleErrors: []`。
- 构建：`bun run build`（主入口、`GOOSE_BUILD_TARGET=quicknote`、`dist-quicknote/` 与 `app/`）通过。
- 未验收（需真实 uTools 宿主）：uTools 原生 `preload` 路径下的 `osVersion`/`arch`/`utools` 版本字段、热启动事件（`goose-note:plugin-enter` / `goose-note:quicknote-enter` / `goose-note:plugin-out`）、MCP `mcp.call`、以及速记小窗真实跨插件存入笔记 `quicknote.save`（浏览器环境无 `utools` 宿主 API）。
