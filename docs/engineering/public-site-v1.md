# KenFutWiki 公开站首版

上游基线：`0b26db72ceb2f0f053a5c48b44546d7a342caacb`。实施分支：`codex/public-site-v1`。

## 固定范围

同一 Node 展示为 docs/article/both，复用正文、发布、评论与 PV。增加文章封面、公开署名、展示日期、一个平铺分类、多个标签、精选、相关推荐和最多两个 CTA。文章地址 `/blog/{slug}`，保留 NodeID 内链及旧 slug 跳转。关键词搜索独立于 AI；多人直接按既有权限发布。Header/Footer 复用已有配置。内部 SSO、MCP、审批、完整历史恢复另行实现。

新增代码和示例仅使用 KenFutWiki 和通用参考产品标识。AGPL、原作者声明与对应源码入口保留。

## HTTP 契约（前后端共同权威）

成功返回 `{success:true,data:T}`，列表 data 为 `{items:T[],total:number,page:number,page_size:number,release_id?:string}`。错误使用真实 HTTP 状态和 `{success:false,message:string}`。管理端复用当前 JWT、X-KB-ID/请求 kb_id 和站点权限；公共端由当前站点 X-KB-ID 决定范围。

### 内容元数据

`GET/PUT /api/kenfut/v1/contents/{node_id}?kb_id=...`：data 为 ContentMetadata。PUT 请求携带 `kb_id` 及元数据字段。

```ts
type LinkTarget = {type:'node'|'site'|'product'|'url';node_id?:string;page?:'home'|'docs'|'blog';product_id?:string;page_key?:string;url?:string;params?:Record<string,string>};
type CTA = {id:string;label:string;target:LinkTarget;style:'primary'|'secondary';new_tab:boolean};
type ContentMetadata = {node_id:string;channel:'docs'|'article'|'both';slug:string;cover_url:string;author_name:string;author_avatar:string;display_date:string;category:string;tags:string[];featured:boolean;featured_order:number;related_node_ids:string[];ctas:CTA[]};
type ContentItem = ContentMetadata & {id:string;kb_id:string;title:string;summary:string;content?:string;content_type:string;created_at:string;updated_at:string;url:string;canonical_url:string;node_release_id:string;pv:number;related?:ContentItem[]};
```

旧 Node 默认 docs。slug 按站点唯一，不因标题变化自动改变。分类/标签是站点内名称，公开聚合自当前发布快照；不新增第二套正文系统。display_date 使用 RFC3339，未填以首发时间为准；公开署名与后台账号分离。

`GET /share/kenfut/v1/contents`：q、channel=all/docs/article、category、tag、featured、page、page_size。

`GET /share/kenfut/v1/contents/{node_id}`：详情。`GET /share/kenfut/v1/articles/{slug}`：按已发布 slug/旧别名解析详情，返回 canonical_url。`GET /share/kenfut/v1/contents/{node_id}/related`：最多两篇，手选优先、共同标签/分类/目录补足。

`GET /share/kenfut/v1/pages`：页面选择器，返回 `{items:[{id,title,url,type:'node'|'site'|'product',target:LinkTarget}]}`；已发布页面+站点入口+启用产品页。`GET /share/kenfut/v1/taxonomies` 返回 `{categories:string[],tags:string[]}`。

正文内链保存稳定 `/node/{id}`；配置型链接保存 LinkTarget。文末顺序：正文、CTA、推荐、相邻导航、评论。富文本使用 inlineLink node；Markdown 使用现有依赖 patch 的 captureSelection/replaceSelection。

### 产品、凭证与漏斗

管理端 `/api/kenfut/v1/products` GET 列表、POST 创建；`/products/{id}` PUT 更新、DELETE 停用；产品为 `{id,name,origin,enabled,pages:[{key,name,path,parameters:string[]}]}`。产品页路径为 origin 内绝对路径，参数仅允许页面声明键，不能覆盖 kf_click_id。

`POST /api/kenfut/v1/products/{id}/credentials` 返回 `{id,token,scopes}`，token 仅创建时显示。`DELETE /api/kenfut/v1/products/{id}/credentials/{key_id}` 撤销。作用域 conversion:write、analytics:read。产品凭证只在服务器使用，存 SHA256 哈希。

`POST /share/kenfut/v1/events/view`：`{event_id,node_id,node_release_id,channel}`。`POST /share/kenfut/v1/ctas/{id}/click`：`{event_id,node_id,node_release_id,view_id}`，返回 `{click_id,url}`。会话取现有匿名 Cookie。重复同一事件不增加计数，预取不计数；失败不阻断跳转。

`POST /integration/kenfut/v1/events`：Bearer 产品凭证，`{event_id,event_type:'registered'|'first_generation_success',occurred_at,subject_id,click_id?}`。registered 为注册事务成功，first_generation_success 为首次真实成功产出。按产品事件ID和产品用户里程碑去重，同ID不同内容返回409；允许回调乱序。

`GET /integration/kenfut/v1/funnel` 与管理端 `GET /api/kenfut/v1/funnel?kb_id=...&product_id=...`：from/to、node_id/cta_id 过滤，data 包含 views,viewers,clicks,clickers,registrations,first_generations,unattributed_registrations,unattributed_first_generations 及分组 items。产品身份由凭证确定，不能越界查询。

30天内最后一次有效 CTA，注册时锁定来源，首生沿用，点击后30天内转化计入。缺失/过期标识未归因，不用IP推断。PG 为幂等权威。明细保留180天，里程碑去重事实/汇总保留。报表分别标明次数、访客、账号口径。

### 运营能力

`GET /api/kenfut/v1/capabilities` 返回发行版实际能力。`GET/PUT /api/kenfut/v1/prompts?kb_id=...` 复用现有 Prompt 字段。`POST /api/kenfut/v1/comments/{id}/moderation`：`{kb_id,status:1|-1}`。不得伪造付费 edition 或取消真实角色权限。

## 所有权与集成

root 独占 Git、依赖/锁文件、Wire/Swagger/客户端生成物、Makefile、migration runner 与 DI provider。backend worker 拥有内容领域/查询发布源码与 SQL 000001_content；admin worker 拥有 web/admin 业务UI及 Markdown patch；app worker 拥有 web/app 业务UI。集成漏斗由 root 负责并使用 SQL 000002_integration；公共 types 的任何契约变化先通知全员。

各 worker 不是唯一协作者；不得覆盖或回滚他人修改，不暂存、不提交。生成与重格式化在集成冻结窗口由 root 串行执行。

## 上游与迁移

origin 保持用户 fork，upstream 指向 chaitin/PandaWiki；通过集成分支普通 merge 固定 tag/SHA，不重写共享 main。Go module 保留。新 SQL 使用 store/pg/kenfut_migration 和独立 kenfut_schema_migrations，先原迁移再扩展迁移。迁移发布后不可重编号/改义。默认公开生成和 lint 不进入私有 pro。

## 验收与交付

逐批受影响Go测试、make lint、前端定向ESLint/build；真实PG验证迁移、发布、搜索和归因；浏览器验证文章、内链、评论、CTA和移动端。新装、既有库升级、重复迁移、上游追加迁移均需验证。协议示例不调用付费模型，不代表任何真实外部业务验收。

代码按设计/基线、内容发布、搜索发现、运营、链接CTA、漏斗、文档验收分批本地提交。CI/CD提供本地命令、环境样例和产物说明，远端发布另行配置。
