# 对应版本源码与构建

项目：https://github.com/eachann1024/goose-notes-utools（uTools 插件版，MIT）

桌面版仓库：https://github.com/eachann1024/goose-notes

项目源码已公开，当前源码使用 MIT。历史版本沿用其发布时的许可。

第三方部分保留各自许可与版权声明。BlockNote core/react/mantine 使用 MPL-2.0；项目对其覆盖文件的补丁保留 MPL-2.0。AI 菜单与 PDF 导出已改为项目独立实现，不再依赖 BlockNote XL AI/PDF 包。

## 构建

使用 package.json 指定的 Bun 版本和 Node.js 20 或以上。

```bash
bun install --frozen-lockfile
node scripts/generate-license-notices.mjs
bun run build
bun run mac    # macOS
bun run win    # Windows
bun run linux  # Linux
```

完整环境与构建说明见 DEVELOP.md。平台构建需要相应操作系统工具链。

## 发布时

每次发布记录 Git 提交与构建步骤，并随包附 LICENSE、THIRD-PARTY-NOTICES.txt 与校验值。
