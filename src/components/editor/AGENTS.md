# 范围

- 只适用于常规笔记本编辑器，速记小窗不走这里；不换 BlockNote，卡顿先查宿主订阅与重块，不迁移 Tiptap / Lexical。

# 热路径

- 保存：`src/components/editor/core/Editor.tsx` 停笔后 800ms 防抖写入 `usePages`，连续打字期间不写 store，打字延迟与 `pages` 订阅无关。
- 侧栏：`SidebarMainTree` 用 `areSidebarPagesEqual`，不要订阅整个 `pages` 引用；zustand v5 会静默忽略 `usePages(selector, equalityFn)` 的第二参数，需用 `zustand/traditional` 的 `useStoreWithEqualityFn(usePages, selector, equalityFn)`。
- 附件、图片与本地文件只通过 `openResourceExternally` 打开，`fileStorage.open` 是 `att-file:` 包装；内部引用判断须覆盖 `att-file:`、`att-video:`，它们不匹配 `startsWith("att:")`，遗漏会导致导出和资产清理错误。
- Toast 使用 `src/components/ui/sonner.tsx` 与 `src/styles/goose-toast.css`，主窗靠右，不设置 `position: relative`。

# 自定义块与文件组织

- `createReactBlockSpec` 不挂 API、Shiki 多实例或重 React 树；非聚焦的 code / file / image 使用轻量视图。
- `codeBlockSpec.tsx`、`Editor.tsx` 不顺手大拆，单开任务再拆；`AiComposerInput.tsx` 只负责组装，逻辑在同目录 `composer*.ts` / `useComposer*.ts`，`editor-base.css` 只保留 `@import`，样式修改定位 `styles/editor-base/` 子文件。
