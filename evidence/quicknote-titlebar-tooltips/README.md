# 速记小窗右上角悬停提示验收

- 启动：`GOOSE_BUILD_TARGET=quicknote bunx vite --host 127.0.0.1 --port 4179 --strictPort`
- 入口：`http://127.0.0.1:4179/quicknote.html`；使用隔离的浏览器任务空间，不输入或修改笔记内容。
- 执行：`ego-browser nodejs < scripts/accept-quicknote-titlebar-tooltips.mjs`
- 操作与预期：依次悬停右上角存入笔记、使用说明、关闭图标，断言对应 `role=tooltip` 的文字；点击使用说明，断言弹层可见。
- 修复前：`before.log`，使用说明悬停断言超时。
- 修复后：`after.log`，使用说明、关闭及弹层点击断言通过；浏览器入口无 uTools 宿主保存能力，存入笔记图标未验收。浏览器记录的相关控制台错误为 `[]`。
- 构建：`build.log`，主入口和小窗入口均成功。
- 待验收：在真实 uTools 小窗内悬停“存到笔记”图标；浏览器入口无法替代宿主验证。
