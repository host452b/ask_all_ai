# AskAll — 一次提问，所有 AI

[English](README.md)

一个问题同时发送给 ChatGPT、Gemini、Claude、DeepSeek、Grok 等 22+ AI 聊天机器人，并排对比所有回答。

> **隐私优先：** 无服务器、无追踪、无数据收集。你的问题直接从浏览器发送到各 AI 网站。

## 安装

**Chrome 应用商店**（推荐）：

<!-- TODO: 发布后替换为实际的 Chrome Web Store 链接 -->
[安装 AskAll](#)

**手动安装（开发者模式）：**

1. 克隆或下载本仓库
2. 打开 `chrome://extensions/` → 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序** → 选择项目文件夹
4. 提前登录各 AI 网站 — AskAll 不会处理登录或授权

## 使用方法

1. 输入你的问题（或从 **历史记录** / **模板** 中加载）
2. 可选择 **提示增强** 策略（思维链、分步骤、专家角色、简洁回答、正反分析）
3. 勾选要查询的 AI 服务
4. 点击 **Send to All**（或 `Ctrl+Enter` / `Cmd+Enter`）
5. 对比回答：**复制全部**、**复制单条**、**导出 Markdown**，或使用 **Debug** 排查错误

## 支持的 AI 服务（22+）

| 分类 | 服务 |
|------|------|
| **通用 — 免费增值** | ChatGPT、Gemini、Claude、Grok、Copilot、Mistral |
| **通用 — 免费** | DeepSeek（深度求索）、Kimi（月之暗面）、Qwen（通义千问）、Doubao（豆包）、Yuanbao（元宝）、ChatGLM（智谱清言）、百度 AI 搜索、搜狗 AI、MiniMax（海螺）、MiMo（小米） |
| **专业 — 免费增值** | Perplexity、Manus |
| **专业 — 免费** | NVIDIA Build（Nemotron、MiniMax-M2.5、Kimi-K2.5、GLM5）、Genspark、Duck.ai、Reddit Answers |
| **自定义** | 可添加任意 AI 聊天网站（最多 10 个） |

## 功能特性

- **批量发送** — 分批打开 AI 网站标签页，自动填入问题并提交
- **提示增强** — 思维链、分步骤、专家角色、简洁回答、正反分析
- **自动轮询** — 通过 DOM 稳定性检测判断 AI 是否完成回答
- **查询历史** — 自动保存最近 50 条查询记录，一键复用
- **提示模板** — 保存常用问题模板（最多 30 个）
- **导出功能** — 复制全部回答或下载为结构化 Markdown 报告
- **单站重试** — 对失败的站点单独重试，无需重发全部
- **三套主题** — Light（纸质墨香）、Lumen（暖色暗黑）、Carbon（工业精密）
- **调试工具** — 内置诊断功能，快速排查问题
- **自定义站点** — 添加任意聊天 URL，自动请求访问权限

## 项目结构

```
ask_all_ai/
├── manifest.json                Manifest V3 配置
├── background/
│   └── service-worker.js        标签页调度、批处理、计时、重试
├── content/
│   ├── site-adapters.js         各站点 DOM 选择器（22 站 + 兜底）
│   └── content-script.js        注入、轮询、内容提取、诊断
├── popup/
│   ├── popup.html               主界面
│   ├── popup.css                三套主题样式
│   └── popup.js                 界面逻辑、历史、模板、导出
├── icons/                       扩展图标（16/48/128）
└── scripts/
    ├── package.sh               构建 Chrome Web Store ZIP
    └── sync-manifest.js         从 popup.js 同步 manifest
```

### 数据流

```
用户 → 弹出窗口（问题 + 站点选择）
  → Service Worker（分批打开标签页，每批 10 个）
    → Content Script（填入问题、提交、轮询 DOM 等待回答）
      → Service Worker（汇总回答和统计数据）
        → 弹出窗口（展示对比卡片、进度条、统计）
          → 复制 / 导出 / 重试
```

## 添加新站点

1. 在 `content/site-adapters.js` 中添加适配器：

```js
"example.com": {
  inputSelector: 'textarea',
  submitSelector: 'button[type="submit"]',
  responseSelector: '[class*="response"]',
  thinkingSelector: '[class*="loading"]',
  useEnterToSubmit: false,
  waitBeforeSubmit: 500,
}
```

2. 在 `popup/popup.js` 的 `SITE_GROUPS` 数组中添加站点
3. 运行 `node scripts/sync-manifest.js` 自动更新 manifest.json

## 已知限制

- 使用前需分别登录各 AI 网站
- 网站 DOM 结构会随时变化，适配器可能需要定期更新
- 部分网站有反自动化措施，可能阻止注入
- 扩展不会选择 AI 模型 — 请提前在各网站配置好首选模型

## 构建

```bash
bash scripts/package.sh
# 输出: dist/askall-v{版本号}.zip
```

## 许可证

[MIT](LICENSE)
