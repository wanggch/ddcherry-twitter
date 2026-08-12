# X Post Saver（ddcherry-twitter）

Chrome / Edge 扩展：在 X（Twitter）帖子详情页或长文章页一键提取内容，复制为 Markdown，并可写入自定义后台或本地 Obsidian 服务。

> 更完整的「项目回顾 + 文档整理原则」见：[项目梳理与文档规范.md](./项目梳理与文档规范.md)  
> 整套系统（扩展 + Rust 本地服务）安装见：[docs/安装指南.md](./docs/安装指南.md)

---

## 它解决什么问题？

浏览 X 时想快速留下内容，而不是手动复制、整理 YAML、再丢进笔记库。本扩展在页面上解析 DOM，统一产出结构化数据，再按配置走三条出口之一（可叠加）。

| 出口 | 触发方式 | 依赖 |
|------|----------|------|
| **剪贴板 Markdown** | 点击扩展图标（主路径）；未配远程 API 时的右键/Popup | 无 |
| **本地 Obsidian** | 点击扩展图标且选项中开启 | 同级项目 `x-likes-to-obsidian`（默认 `http://127.0.0.1:18787`） |
| **自定义远程 API** | Popup / 右键菜单（配置了 `apiUrl` 时） | 你自己的后端 |
| **本地笔记服务（旁路）** | Popup 中的本地保存按钮 | 外部服务 `http://127.0.0.1:27123`（见 [docs/接口](./docs/接口/本地笔记服务-API.md)） |

## 支持的页面

- 普通帖子：`https://x.com/{user}/status/{id}`（兼容 `twitter.com`）
- 长文章：`https://x.com/i/article/{id}`

## 快速开始

```bash
npm install
npm run build
```

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择本仓库的 `dist/` 目录
4. 打开扩展选项：按需填写远程 API、开启本地 Obsidian、确认本地服务地址

开发监听构建：

```bash
npm run dev
```

测试：

```bash
npm test
```

## 项目结构（源码）

```text
src/
├── background/          # Service Worker：图标点击、右键菜单、消息路由
├── content-script/      # 页面内：帖子 / 长文章 DOM 提取
├── common/              # 类型、存储、API、Markdown、Obsidian payload
├── popup/               # 预览与保存 UI
└── options/             # 配置页
public/                  # manifest.json、图标
dist/                    # 构建产物（浏览器加载此目录）
docs/                    # 安装、接口、历史需求归档
```

## 配置项（chrome.storage.sync）

| 字段 | 含义 | 默认 |
|------|------|------|
| `apiUrl` | 远程保存接口，空则走剪贴板模式 | `""` |
| `apiKey` | `Authorization: Bearer …` | `""` |
| `enableObsidian` | 图标点击后是否 POST 到本地 Obsidian 服务 | `false` |
| `obsidianBaseUrl` | 本地服务根地址 | `http://127.0.0.1:18787` |

图标点击主流程：提取 → 复制 Markdown →（可选）`POST {obsidianBaseUrl}/api/tweets/import`。

## 关联项目

| 路径 | 角色 |
|------|------|
| `../x-likes-to-obsidian` | 本地 Rust 服务：去重、DeepSeek 转写、写 Obsidian vault |
| `../x-likes-to-obsidian-mvp.md` | 早期整体方案（父目录） |

## 技术栈

TypeScript · Vite · Chrome Extension Manifest V3 · Vitest

## 文档索引

| 文档 | 说明 |
|------|------|
| [项目梳理与文档规范.md](./项目梳理与文档规范.md) | 项目全貌、演进、文档整理原则 |
| [docs/安装指南.md](./docs/安装指南.md) | 新电脑安装扩展 + 本地服务 |
| [docs/接口/本地笔记服务-API.md](./docs/接口/本地笔记服务-API.md) | 旁路 `27123` 笔记服务接口 |
| [docs/归档/](./docs/归档/) | 立项 Prompt、长文章需求（历史） |

## 许可证

MIT
