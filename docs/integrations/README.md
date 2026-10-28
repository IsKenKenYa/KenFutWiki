# KenFutWiki 通用产品接入

本接口供独立产品查询公开内容、承接带来源的跳转、报告业务转化及查询自己的聚合漏斗。产品通过标准 HTTP 接入；仓库不包含任何特定外部产品适配器。

## 配置产品与 CTA

在后台「内容运营」登记产品名称、origin、页面 key、路径及允许的参数。例如产品 origin `https://studio.example.com`，页面 key `canvas`，路径 `/canvas`，允许参数 `template`、`campaign`。本地参考产品可使用 `http://127.0.0.1:4180`；非本机产品要求 HTTPS。

编辑文档的文章属性，选择文档/文章展示位置、分类、标签及文末 CTA。CTA 选择已登记产品页面并填写参数，保存草稿后执行原有发布操作。站内链接选页面，存储稳定 NodeID；修改 slug 不会破坏这些引用。

## 凭证

每个产品使用独立服务端 Bearer，分配 `conversion:write`、`analytics:read`。创建时只显示一次明文；可撤销、轮换。不要放入浏览器、链接、前端环境变量或源码。产品身份由凭证决定，不能使用请求字段切换产品或站点。

## 转化事件

点击有效 CTA 后，KenFutWiki 在目标地址附加 `kf_click_id`。产品落地后应将其保存在自己的访客/注册上下文，经过登录跳转仍保留，不能依赖跨域 Cookie。

产品注册事务成功后回传 `registered`；该用户第一次成功产出后回传 `first_generation_success`。提交任务、排队和失败不算成功。主体标识应是产品内不透明ID，不传手机号、邮箱、生成正文或密钥。

```json
{
  "event_id": "c3e10345-04fb-44b6-b952-4c505650718c",
  "event_type": "registered",
  "occurred_at": "2026-10-28T08:00:00Z",
  "subject_id": "opaque-account-id",
  "click_id": "aaf22b29-e60f-44a9-9843-4be3fa5556fd"
}
```

服务端向 `POST /integration/kenfut/v1/events` 发送 JSON 并附加 `Authorization: Bearer <server credential>`。同一事件重试必须使用原 event_id 和原请求体；重复成功返回200，事件ID复用于不同内容返回409。401表示凭证或scope无效，429/5xx/网络失败使用退避重试，其他4xx先纠正请求。事件回调允许乱序，但业务发生时间应准确。

归因采用产品内30天最后有效CTA，注册时锁定，首次成功生成沿用注册来源，点击后30天内转化计入。没有有效标识时记录未归因，不用IP推断。报表的次数、访客、账号是不同口径；按日期筛选的是来源浏览/点击cohort。

## 查询

公开内容：`GET /share/kenfut/v1/contents?q=关键词&channel=article&page=1&page_size=20`；详情 `/contents/{node_id}`；文章 `/articles/{slug}`；目录 `/pages`；分类与标签 `/taxonomies`。公开权限与站点网页一致，不借用产品凭证读取私有草稿。

本产品漏斗：`GET /integration/kenfut/v1/funnel?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z`，使用 analytics:read 凭证。可加 node_id、cta_id；不能查询其他产品。成功结构统一为 `{success:true,data:...}`，错误为真实HTTP状态及 `{success:false,message:...}`。

## 本地参考产品

```sh
KENFUT_BASE_URL=http://127.0.0.1:8000 KENFUT_PRODUCT_TOKEN=服务器凭证 node examples/reference-product/server.mjs
```

将后台产品页面登记为上述4180端口的 `/`，发布 CTA，然后从文章进入参考产品，完成注册及参考任务，检查四段漏斗。示例任务是确定性的本地结果，不调用付费模型；它验证协议，不代表外部业务产品已通过验收。SDK位于 `sdk/kenfut/client.mjs`；生产环境须持久化事件并在失败后重试，不能照搬示例内存存储。

## 开源与交付

运行版本的源码入口须指向实际部署提交及完整对应源码，包含构建部署说明。可通过 `NEXT_PUBLIC_SOURCE_URL`、`VITE_APP_SOURCE_URL` 配置到 fork 的确定提交。原作者声明和 AGPL 保留，业务数据、服务器凭证不进入源码包。

## SDK 许可证

本仓库的 SDK 和参考产品沿用 AGPL-3.0。独立产品可直接按公开 HTTP／URL 协议实现客户端，无须嵌入 SDK；复制或链接 SDK 代码时应遵守其许可证并评估组合方式。第三方依赖和上游声明继续保留。


TypeScript（NodeNext／ESM）可直接导入 `sdk/kenfut/client.mjs`，同目录的 `client.d.mts` 提供事件与漏斗类型。建议在业务事务中持久化 `client.createEvent(...)` 的返回值，再将这个同一对象交给 `client.sendEvent(event)` 重试，不要每次重试重新生成event_id。
