执行前请学习全局提示词 `~/AGENTS.md`。

# 项目范围

- 本项目是 uTools 插件。先判断任务属于速记小窗、常规笔记本还是两者共享。速记小窗入口为 `quicknote.html`，用 `__GOOSE_LITE__` 精简构建，样式在 `src/pages/quick-note/quicknote.css`，清单是 `quicknote-plugin.json`，预加载是 `preload/preload-quicknote.cjs`。

# 构建与验收

- 每次改动后执行 `bun run build`，失败就修到通过；会分别生成笔记本 `dist/` 和小窗 `dist-quicknote/`，ZTools 发布须带上构建同步的 `app/`。
- 功能改动走一遍主流程；改共享编辑器时两个入口都看一下。用隔离测试数据，不动用户真实笔记。
- uTools API、系统剪贴板等宿主能力在 uTools 里验证，验证不了就在交付时注明。
- 交付只说修了什么、构建结果和未验收项。

## 提交与推送

- 改动验收后直接提交并推送 `main`，无需询问：先保留未提交工作，`git fetch origin` 并合入 `origin/main`，逐项解决冲突（保留双方有效改动），再只原子提交本任务改动，提交说明用英文。
- 推送被拒就重新同步、复核后重试，直到远端包含本次提交；不强制推送，不覆盖无关工作。
