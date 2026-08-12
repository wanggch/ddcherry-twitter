# Markdown Generation Service API 文档

> **文档状态**：外部/旁路接口说明  
> **端口**：`27123`（与主链路 `x-likes-to-obsidian` 的 `18787` 不同）  
> **本仓库用法**：Popup 中的「保存到本地笔记」调用 `POST /api/note`（见 `src/popup/popup.ts` 中 `LOCAL_NOTE_API_URL`）  
> **注意**：本接口**不属于**本仓库代码；实现服务需另行部署。主推荐链路是 `18787` 的 Obsidian 导入服务。

## 概述

本服务是一个本地 Markdown 文件生成服务，接收 JSON 格式的数据并生成标准化的 Markdown 文件。

**基础 URL**: `http://127.0.0.1:27123`

## 接口列表

### 1. 创建笔记

接收 JSON 数据，生成 Markdown 文件并保存到指定目录。

**请求**

```http
POST /api/note
```

**请求头**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| Content-Type | string | 是 | 必须为 `application/json` |

* 仅当服务配置了 API 密钥时必需

**请求体**

| 字段 | 类型 | 必需 | 约束 | 说明 |
|------|------|------|------|------|
| title | string | 是 | 最大 200 字符 | 笔记标题，将作为文件名和 H1 标题 |
| content | string | 是 | - | 笔记正文内容 |
| folder | string | 否 | - | 保存的子目录名称（相对于配置的根目录） |

**请求示例**

```json
{
  "title": "我的第一篇笔记",
  "content": "这是笔记的内容，支持 **Markdown** 格式。",
  "folder": "inbox"
}
```

**成功响应**

- **状态码**: `200 OK`
- **Content-Type**: `application/json`

```json
{
  "ok": true,
  "filename": "20250122_my-first-note.md",
  "path": "/Users/user/Documents/notes/inbox/20250122_my-first-note.md",
  "status": "saved",
  "took_ms": 15
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| ok | boolean | 请求是否成功 |
| filename | string | 生成的文件名（格式：`YYYYMMDD_title.md`） |
| path | string | 文件的完整绝对路径 |
| status | string | 文件状态，固定为 `saved` |
| took_ms | number | 处理耗时（毫秒） |

**错误响应**

- **状态码**: `4xx` 或 `5xx`
- **Content-Type**: `application/json`

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required",
    "details": {
      "field": "title"
    }
  }
}
```

**错误码列表**

| 错误码 | 状态码 | 说明 |
|--------|--------|------|
| METHOD_NOT_ALLOWED | 405 | 使用了不允许的 HTTP 方法 |
| UNAUTHORIZED | 401 | API 密钥无效或缺失 |
| READ_ERROR | 400 | 读取请求体失败 |
| INVALID_JSON | 400 | JSON 格式错误 |
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| WRITE_ERROR | 500 | 文件写入失败 |

---

## 生成的 Markdown 文件格式

服务生成的 Markdown 文件采用以下标准格式：

```markdown
---
title: 页面标题
created_at: 2025-01-22T10:30:00Z
---

# 页面标题

正文内容
```

---

## 文件命名规则

1. **格式**: `{YYYYMMDD}_{slugified-title}.md`
2. **日期**: 使用服务器当前日期（UTC）
3. **标题处理**:
   - 转换为小写
   - 空格替换为连字符 `-`
   - 移除特殊字符
4. **冲突处理**: 如果文件已存在，自动添加后缀 `-1`, `-2` 等

**示例**

| 输入标题 | 生成的文件名 |
|----------|-------------|
| 我的笔记 | `20250122_my-note.md` |
| Hello World! | `20250122_hello-world.md` |

---

## cURL 示例

### 创建笔记

```bash
curl -X POST http://127.0.0.1:27123/api/note \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "title": "API 测试笔记",
    "content": "这是通过 API 创建的笔记。",
    "folder": "inbox"
  }'
```

### 不指定文件夹

```bash
curl -X POST http://127.0.0.1:27123/api/note \
  -H "Content-Type: application/json" \
  -d '{
    "title": "根目录笔记",
    "content": "保存到根目录的笔记。"
  }'
```

---

## 注意事项

1. **监听地址**: 服务默认只监听 `127.0.0.1`，仅允许本地访问
2. **API 密钥**: 建议在生产环境配置 API 密钥以提高安全性
3. **路径安全**: `folder` 字段会进行安全检查，防止目录遍历攻击
4. **文件编码**: 生成的 Markdown 文件使用 UTF-8 编码
5. **幂等性**: 重复请求会创建多个文件（文件名会添加后缀）

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2025-01-22 | 初始版本 |
