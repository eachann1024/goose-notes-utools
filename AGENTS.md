# 鹅的笔记 · uTools 插件

- 本仓长期维护 uTools 插件版，只发布插件包；同源 Electron 桌面版在 `goose-note`，不沿用桌面 App 的交付流程。
- 开始任务先判断目标属于速记小窗、常规笔记本或两者共享；速记小窗是独立轻量草稿，入口 `quicknote.html`，由 `__GOOSE_LITE__` 和 `quicknote.css` 隔离。
- 实现只改 `src/`；`app/`、`dist/` 由 `bun run build` 生成，不手改 chunks。
- 修改常规编辑器前读取 [编辑器规则](src/components/editor/AGENTS.md)，涵盖热路径、附件打开和侧栏订阅。
