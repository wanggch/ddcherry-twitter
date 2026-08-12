# X 长文章解析需求

> **文档状态**：历史归档（需求规格）  
> **实现状态**：已基本落地（`articleExtractor.ts`、`ArticleData`、右键菜单、Popup 预览等）  
> **用途**：回看设计动机与验收清单；细节以当前源码为准。

## 背景

当前扩展支持解析普通 X 帖子（`x.com/{user}/status/{id}`），但 X 平台还有长文章功能（Article），URL 格式为 `x.com/i/article/{id}`。长文章与普通帖子在页面结构和数据提取方式上有显著差异，需要单独支持。

## 需求概述

支持识别和解析 X 长文章页面，提取文章标题、正文、封面图、作者信息等，并保存到后台。

## 功能需求

### 1. URL 识别

**需求 ID**: ARTICLE-1.1  
**描述**: 识别 X 长文章 URL 格式  
**规则**:
- 匹配格式: `https://x.com/i/article/{articleId}`
- 也支持 `https://twitter.com/i/article/{articleId}`
- articleId 为数字字符串

### 2. 页面检测

**需求 ID**: ARTICLE-1.2  
**描述**: 在长文章页面显示扩展功能  
**实现**:
- 在 `manifest.json` 的 `content_scripts.matches` 中添加长文章 URL 匹配规则
- 在 content script 中检测当前页面是否为长文章页面

### 3. 数据提取

#### 3.1 文章 ID

**需求 ID**: ARTICLE-2.1  
**描述**: 从 URL 提取文章 ID  
**示例**: `https://x.com/i/article/1234567890` → `1234567890`

#### 3.2 文章标题

**需求 ID**: ARTICLE-2.2  
**描述**: 提取文章标题  
**DOM 选择器**: 
- 优先: `h1` 标签或 `[data-testid="article-title"]`
- 备用: `<title>` 标签或 `meta[property="og:title"]`

#### 3.3 文章正文

**需求 ID**: ARTICLE-2.3  
**描述**: 提取文章完整正文内容  
**DOM 选择器**:
- 文章容器: `article` 或 `[data-testid="article-content"]`
- 段落: `p` 标签
- 保留格式: 段落换行、链接、加粗等基本格式

#### 3.4 封面图

**需求 ID**: ARTICLE-2.4  
**描述**: 提取文章封面图片  
**DOM 选择器**:
- `[data-testid="article-cover"] img`
- 或 `meta[property="og:image"]`

#### 3.5 作者信息

**需求 ID**: ARTICLE-2.5  
**描述**: 提取文章作者信息（复用现有 AuthorData 结构）  
**字段**:
- displayName: 作者显示名称
- handle: 作者 @用户名
- avatarUrl: 作者头像
- profileUrl: 作者主页链接

#### 3.6 发布时间

**需求 ID**: ARTICLE-2.6  
**描述**: 提取文章发布时间  
**DOM 选择器**: `time[datetime]` 或 `meta[property="article:published_time"]`  
**格式**: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)

#### 3.7 文章内图片

**需求 ID**: ARTICLE-2.7  
**描述**: 提取文章正文中的所有图片  
**DOM 选择器**: 文章容器内的所有 `img` 标签（排除头像、图标等）

### 4. 数据结构

**需求 ID**: ARTICLE-3.1  
**描述**: 定义长文章数据类型

```typescript
export interface ArticleData {
  articleId: string;          // 文章 ID
  url: string;                // 文章完整 URL
  title: string;              // 文章标题
  content: string;            // 文章正文（纯文本或 Markdown）
  coverImage?: string;        // 封面图 URL（可选）
  images: string[];           // 正文图片 URL 列表
  author: AuthorData;         // 作者信息（复用现有类型）
  createdAt: string;          // 发布时间 ISO 8601
}
```

### 5. API 接口

**需求 ID**: ARTICLE-4.1  
**描述**: 向后台 API 发送长文章数据  
**请求格式**:

```json
{
  "type": "article",
  "articleId": "1234567890",
  "url": "https://x.com/i/article/1234567890",
  "title": "文章标题",
  "content": "文章正文内容...",
  "coverImage": "https://pbs.twimg.com/...",
  "images": ["https://pbs.twimg.com/..."],
  "author": {
    "displayName": "作者名",
    "handle": "@username",
    "avatarUrl": "https://pbs.twimg.com/...",
    "profileUrl": "https://x.com/username"
  },
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**注意**: 添加 `type` 字段区分普通帖子（`post`）和长文章（`article`）

### 6. UI 交互

#### 6.1 Popup 显示

**需求 ID**: ARTICLE-5.1  
**描述**: 在长文章页面打开 Popup 时显示文章预览  
**显示内容**:
- 文章标题（突出显示）
- 正文前 200 字符预览
- 封面图缩略图（如有）
- 作者信息
- 发布时间

#### 6.2 右键菜单

**需求 ID**: ARTICLE-5.2  
**描述**: 在长文章页面右键显示保存选项  
**菜单文本**: "Save this article"（区别于 "Save this post"）

#### 6.3 保存反馈

**需求 ID**: ARTICLE-5.3  
**描述**: 保存成功/失败后显示通知  
**消息**:
- 成功: "Article saved successfully!"
- 失败: "Failed to save article: {错误信息}"

### 7. 错误处理

**需求 ID**: ARTICLE-6.1  
**描述**: 长文章特定的错误处理  
**错误类型**:
- `ARTICLE_NOT_FOUND`: 无法找到文章容器
- `ARTICLE_TITLE_MISSING`: 缺少文章标题
- `ARTICLE_CONTENT_MISSING`: 缺少文章正文
- `ARTICLE_AUTHOR_MISSING`: 缺少作者信息

### 8. 降级方案

**需求 ID**: ARTICLE-7.1  
**描述**: DOM 解析失败时的备用方案  
**实现**:
1. 优先从 DOM 提取数据
2. 失败时尝试从 meta 标签提取
3. 仍失败则提示用户页面未完全加载，建议刷新

## 技术实现建议

### 文件修改清单

1. **src/common/types.ts**
   - 添加 `ArticleData` 接口
   - 添加文章相关错误码

2. **src/common/urlParser.ts**
   - 添加 `extractArticleId()` 函数
   - 添加 `isArticlePage()` 函数

3. **src/content-script/articleExtractor.ts** (新建)
   - 实现文章数据提取逻辑
   - 参考 `postExtractor.ts` 结构

4. **src/content-script/contentScript.ts**
   - 添加文章页面检测
   - 处理文章数据提取消息

5. **src/popup/popup.ts**
   - 区分帖子和文章的显示逻辑
   - 添加文章预览 UI

6. **src/background/serviceWorker.ts**
   - 添加文章保存的右键菜单项
   - 处理文章保存请求

7. **public/manifest.json**
   - 在 `content_scripts.matches` 添加 `*://x.com/i/article/*`
   - 在 `content_scripts.matches` 添加 `*://twitter.com/i/article/*`

### 实现优先级

**P0 (核心功能)**:
- URL 识别和页面检测
- 基本数据提取（ID、标题、正文、作者）
- API 保存功能

**P1 (增强功能)**:
- 封面图和正文图片提取
- Popup 预览 UI
- 右键菜单

**P2 (优化)**:
- 错误处理和降级方案
- 格式保留（Markdown 转换）

## 测试用例

### 测试 URL 示例

```
https://x.com/i/article/1234567890
https://twitter.com/i/article/9876543210
```

### 测试场景

1. 正常文章页面 - 完整数据提取
2. 无封面图文章 - 可选字段处理
3. 纯文本文章 - 无图片场景
4. 页面未加载完成 - 错误处理
5. 网络请求失败 - API 错误处理

## 兼容性说明

- 保持与现有帖子保存功能的兼容
- 后台 API 需要通过 `type` 字段区分数据类型
- 现有配置（API URL、API Key）复用，无需额外配置

## 未来扩展

- 支持文章导出为 Markdown 文件
- 支持文章内嵌视频提取
- 支持文章评论区数据提取
