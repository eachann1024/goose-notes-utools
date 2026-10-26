
- 我们是uTools 插件。
- 开始任务先判断目标属于速记小窗、常规笔记本或两者共享；速记小窗是独立轻量草稿，入口 `quicknote.html`，由 `__GOOSE_LITE__` 和 `quicknote.css` 隔离。
- 每次改动原子提交推送。
- 改了构建产物布局后，执行 `node scripts/check-utools-size.js --update` 更新体积基线。

