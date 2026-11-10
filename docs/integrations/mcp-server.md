# MCP Server 接入

KenFutWiki 通过 MCP（Model Context Protocol）向外部 Agent Harness 提供知识库读写能力。Agent 可以直接检索、创建、编辑、移动和发布文档，不需要人工复制粘贴。

## 启用

1. 进入管理端 `设置 -> MCP 设置`。
2. 打开 `MCP Server` 开关。
3. 选择读取权限：
   - `开放读取，写入需要 Token`：匿名可以读取，写入、发布和运营操作需要 API Token。
   - `读取和写入都需要 Token`：所有操作都需要 API Token。
4. 在 `API Token` 区域创建 Token。Token 权限决定可调用的工具：
   - `doc_manage`：读取、写入、发布。
   - `data_operate`：读取、评论审核、贡献审核、统计。
   - `full_control`：全部工具。

## 端点

协议为 Streamable HTTP，地址为：

```text
https://<知识库域名>/mcp
```

多个知识库共用域名时，使用带 `kb_id` 的地址：

```text
https://<域名>/mcp?kb_id=<知识库 ID>
```

请求头：

```text
Authorization: Bearer <API Token>
```

也支持 `X-API-Key: <API Token>`。

## 客户端配置

Claude Code：

```bash
claude mcp add --transport http kenfut-wiki https://docs.example.com/mcp \
  --header "Authorization: Bearer <API Token>"
```

Cursor：

```json
{
  "mcpServers": {
    "kenfut-wiki": {
      "url": "https://docs.example.com/mcp",
      "headers": {
        "Authorization": "Bearer <API Token>"
      }
    }
  }
}
```

## 工具

读取：

- `get_wiki_info`：知识库信息、分栏、文档数量、当前权限。
- `list_navs`：分栏列表。
- `list_docs`：按分栏、父目录、状态、关键词列出文档。
- `get_doc`：读取草稿或已发布内容，支持 HTML 转 Markdown。
- `search_docs`：关键词检索草稿；`mode=semantic` 通过 RAG 检索已发布内容。
- `list_releases`：发布记录。
- `list_doc_versions`：文档历史版本。
- `get_doc_version`：读取指定历史版本。

写入：

- `create_nav`、`update_nav`、`delete_nav`。
- `create_doc`：创建草稿。
- `update_doc`：更新草稿，支持 `expected_updated_at` 版本冲突检测。
- `move_doc`：调整分栏、父目录或前后位置。
- `delete_doc`：需要 `confirm_name` 与文档标题一致；删除非空目录需要 `recursive=true`。
- `restore_doc_version`：把历史版本恢复到草稿。
- `upload_asset`：上传图片或附件，返回公开地址。

发布：

- `publish_docs`：按文档 ID 创建发布版本，公开页面与 RAG 索引随发布更新。

运营：

- `list_comments`、`moderate_comment`。
- `list_contributions`、`audit_contribution`。
- `get_stats`：流量、问答量、热门文档。

## 推荐工作流

```text
list_navs / search_docs
  -> get_doc（拿到 updated_at）
  -> update_doc（带 expected_updated_at）
  -> publish_docs
  -> get_doc(source=published) 验证公开内容
```

## 安全约束

- 草稿与发布分离。`update_doc` 只修改草稿，`publish_docs` 才会更新公开页面。
- 更新和恢复支持 `expected_updated_at`。时间不一致时返回冲突，Agent 需要重新读取后再修改。
- 创建、更新、删除、发布、贡献审核支持 `idempotency_key`，避免重试产生重复内容。
- 删除文档与分栏必须提供 `confirm_name`。
- `READONLY=1` 时所有写入、发布、运营工具返回只读错误。
- 每次工具调用写入 `mcp_calls`，记录工具名称、状态、耗时、令牌与远程地址。

## 故障排查

- `401 API token is required`：Token 缺失或无效。
- `403 token does not belong to this knowledge base`：Token 与当前知识库不匹配。
- `404 MCP server is not enabled`：知识库的 MCP Server 未开启。
- `document has been modified`：文档在读取后被其他人修改，重新读取并携带新的 `updated_at`。
- `permission denied for this tool`：Token 权限不足，检查 Token 的权限级别。
