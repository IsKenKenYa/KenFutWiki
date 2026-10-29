# 公开站 CTA、内链与漏斗复核

日期：2026-10-29。复核基线：`41beff40`；分支：`codex/public-site-v1`。

## 本轮要求与实现位置

| 要求 | 实现与使用方式 |
|---|---|
| 正文内链与文章结尾动作按钮 | 富文本和 Markdown 工具栏的“链接到页面”；文章属性可配置最多两个 CTA，支持文案、主次样式、目标、参数和新窗口 |
| 关联链接使用页面选择器 | 正文、CTA、相关推荐及原 Header/Footer 链接字段复用 `PagePicker`；站内内容保存 NodeID，产品页面选择已登记页面键 |
| 返回顶部与首页一致 | 复用 PandaWiki 的 `ScrollToTopFab`；文章对应 window，文档对应原滚动容器 |
| 四段转化漏斗 | 正文展示后记录浏览，显式按钮操作记录点击；产品服务器回传注册和首次成功生成，后台“内容运营／转化漏斗”查看 |

产品主页、画布和领取页通过“内容运营／产品接入”登记 origin、页面键、路径和允许参数，再在文章 CTA 中选择。站点不包含特定产品的硬编码适配。

## 本轮修补

- 页面选择器打开或用途切换时清理旧搜索和分类，相关推荐始终仅显示内容页面；CTA 不再错误排除已设置为推荐的页面。
- 稳定 NodeID 和旧 slug 跳转保留中文、空值和重复键查询参数，子路径保持一次。
- 产品页面参数在保存与发布时校验；公开 CTA 的只读 `resolved_url` 由服务器生成，统计失败时继续使用同一个已校验地址。失效或不可访问目标不展示按钮。
- 本机 HTTP 外链验证规则在配置与点击解析间保持一致。
- 新增四段 HTTP 落库回归，验证每段一次、同事件重试不增量，并补充页面选择、参数校验及重定向回归。

UI 沿用现有 MUI 按钮、Dialog、列表、PandaWiki Header/Footer 和返回顶部组件；本轮不新增生产页面或设计体系。

## 实际验收记录

- 真实 PostgreSQL 全包测试：`go test ./... -skip '^TestDiscord$' -count=1` 通过；仅排除上游占位凭证联网且永久阻塞的 Discord 手工用例。
- 四段 HTTP 回归 `TestKenFutFourStageFunnelHTTP` 得到 `1 → 1 → 1 → 1`；重复投递每段事件仍保持一次。
- 真实浏览器完成文章展示、主 CTA 跳转、注册、首次成功结果与 HTTP 回传。聚合去重访客口径为 `1 → 1 → 1 → 1`，注册和生成未归因数均为 0；开发热更新导致该访客有两次实际正文展示，浏览次数单独保留为 2。
- 次 CTA “去领取”实际跳转文章页，保留 `source=article` 与中文参数；返回顶部平滑滚动后 `window.scrollY=0`。
- 管理端真实组件夹具验证产品筛选切换为相关推荐、推荐页面仍可选作 CTA、中文参数和新窗口保存后重开。页面目录与保存接口为明确固定的测试数据。
- HTTP／SSR 六项全部通过，包括子路径、稳定 ID 和旧 slug 保参；链接、Markdown、漏斗口径与 SDK 的十九项离线回归通过，可选 SDK live 测试未在本轮重复执行。
- 已重新生成公开 Swagger／Wire 和前端客户端；定向 ESLint 零错误，编辑器夹具存在四条 Fast Refresh 提示。
- 后端 `make lint` 为 0 issues，`go build ./...` 通过；生成客户端后执行整个 web workspace 的生产构建，管理端 TypeScript／Vite 与公开站 Next.js 均通过。保留既有大 chunk 等非阻断警告。

浏览器证据：`kenfut-cta-review.png`、`kenfut-cta-settings-regression.jpg`、`kenfut-picker-regression.jpg`，存放在本轮 Codex visualizations 目录。

## 验证边界

本机夹具使用真实 PostgreSQL、发布、内容与事件处理器，替代生产 ShareAuth/Redis 和部分站点投影。参考产品的首次生成是确定性的本地结果，不调用付费模型。外部业务产品仍需在自己的服务端接入两个转化事件并联调；不会仅凭跳转就推断注册或生成成功。完整生产认证、S3、NATS、RAG 和远端 CI/CD 不属于本轮实测范围。
