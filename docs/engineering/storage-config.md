# 对象存储配置（存储可插拔）

系统支持任意 S3 兼容对象存储（内置 MinIO、阿里云 OSS、其他兼容服务），**不再强制绑定 MinIO**。后端进程（api/consumer/migrate）启动时不再连接存储——存储不可用不影响启动，仅在实际读写文件时报错。

## 配置来源与优先级

1. **数据库配置（页面保存，最高优先级）**：`system_settings` 表 key=`storage`，由管理端「系统设置 → 存储配置」或安装向导「文件存储」步骤写入。
2. **环境变量默认值（未保存过页面配置时生效）**：

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `S3_ENDPOINT` | 服务地址 host[:port]，不含协议 | `panda-wiki-minio:9000` |
| `S3_ACCESS_KEY` | Access Key | `s3panda-wiki` |
| `S3_SECRET_KEY` | Secret Key | 空 |
| `S3_BUCKET` | 桶名 | `static-file` |
| `S3_REGION` | Region | `us-east-1` |
| `S3_SECURE` | 是否 HTTPS（`true`/`1`） | `false` |
| `S3_PUBLIC_URL` | 公网访问基址 | 空 |

「恢复默认」按钮删除数据库配置，回退到环境变量默认值。

## 热切换

api 进程保存配置后立即生效；consumer 等其他进程由 `store/s3.ClientHolder` 每 60 秒比对数据库配置自动重建客户端，无需重启。构建失败时按 10 秒退避重试，期间上传接口返回明确的错误信息。

## URL 规则

- **配置了 `public_url`**：上传返回 `"{public_url}/{key}"` 绝对地址（推荐 OSS 场景填桶的公网域名）。
- **未配置**：返回相对路径 `"/static-file/{key}"`，经 admin nginx / web app rewrite 同源反代访问（默认桶名场景）。
- **约束**：站点反代按默认桶名 `static-file` 前缀转发，因此**使用非默认桶名时必须配置 `public_url`**（前后端均有校验）。
- 服务端内部拉取（文档解析、微信头像上传）使用 `InternalURL`/`AbsURL`：`public_url` 优先，否则 endpoint 直连。

## 阿里云 OSS 接入步骤

1. OSS 控制台创建桶（读写权限建议「公共读」，或私有桶 + 配置 `public_url` 为已绑定域名）。
2. 管理端「系统设置 → 存储配置」→ 存储类型选「阿里云 OSS」→ 填 Endpoint（如 `oss-cn-hangzhou.aliyuncs.com`）、AK/SK、桶名、`public_url`（桶公网域名，如 `https://bucket.oss-cn-hangzhou.aliyuncs.com`）。
3. 「测试连接」验证（连接 + 上传/读取/删除探测对象）→ 保存。
4. 注意：OSS 的 S3 兼容层不支持 S3 Bucket Policy JSON，自动建桶后的公读策略设置会以 warning 形式提示，需在控制台手动设置桶公共读 ACL。

## 管理 API（admin 角色）

- `GET  /api/v1/storage/setting` — 当前生效配置（secret 掩码）+ 客户端状态（来源/是否可用/最近错误与警告）
- `POST /api/v1/storage/setting` — 校验+试连+保存+立即生效；secret 留空或传 `******` 表示沿用原值
- `POST /api/v1/storage/test` — 用给定配置做连接与读写探测，不落库
- `DELETE /api/v1/storage/setting` — 删除页面配置，恢复环境变量默认

## 已知限制

- SecretKey 明文存储于 `system_settings` JSONB（与现有模型 API Key 先例一致）；如需加密需另行引入主密钥管理。
- 切换存储不迁移历史文件：已入库内容中的旧地址保持不变。
- 切换瞬间的少量上传可能失败一次，重试即可。
