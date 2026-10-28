# 上游合并与本地验证

origin 是当前 fork，upstream 是 PandaWiki。开发分支 codex/public-site-v1；共享 main 保留历史，通过临时集成分支 merge 确定 tag/SHA。不得通过整文件 ours/theirs 覆盖发布/权限接缝或生成物。

## 必须复核的接入点

- Node/KB 发布：正文、扩展快照、manifest同一事务；RAG在提交后同步。
- 目录与公开查询：docs/article/both、发布快照、实际访问权限。
- SQL：原 migration/schema_migrations 先执行，kenfut_migration/kenfut_schema_migrations 后执行，不重编号已发布文件。
- Wire provider 和生成的 API/consumer/migrate入口。
- 前端 NodeID路由、blog、SSR canonical、proxy统计责任、页面选择器及 Markdown patch。
- 能力清单只开放已实现功能，真实站点角色仍校验。
- PV由kenfut_node_pv逐事件累计；旧node_stats只保留兼容汇总，禁止再次将其日汇总累加进新计数。000003迁移保留升级前展示基线，历史计数不追溯重算。

## 本地命令

Go使用项目指定1.24.3；默认Makefile导出GOTOOLCHAIN，可由环境显式覆盖。安装Go依赖后执行 `cd backend && make generate && make lint && make test && make build`。工具覆盖变量SWAG、WIRE、GOLANGCI_LINT支持本机路径，默认按固定公开版本运行。make test显式跳过上游TestDiscord：该用例使用占位凭证连接外部服务并永久阻塞；其源码保留，离线验收不调用它。

前端仅pnpm：`cd web && pnpm install --frozen-lockfile && pnpm build`；app的lint使用ESLint flat配置。公开客户端生成 `pnpm api` 自动从仓库中的公开Swagger启动临时本机文档服务器，无须运行API或私有Pro Swagger。

PG集成测试设置KENFUT_TEST_DSN，使用专用数据库，测试自建随机schema。不要指向真实业务数据。验证新装、重复启动、上一版升级和追加上游迁移后升级。

后续CI/CD复用这些命令及公开Dockerfile。现有上游workflow中的私有模块、官方registry与secrets不应直接用于fork发行；本轮不触发这些远端发布。Sentry构建和运行上报默认关闭，使用自有DSN后显式开启；后端安装/用量遥测同样需要config.yaml显式设置telemetry.enabled和telemetry.endpoint，默认不向上游上报。

每次发行记录上游基线SHA、fork SHA、迁移版本、已通过/未执行检查、构建产物与对应源码URL。接口协议见 docs/integrations/README.md。
