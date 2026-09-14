# Chrome Web Store Listing / 上架资料与 ASO 优化

> 本文件汇总提交 Chrome Web Store 审核与商店搜索优化（ASO）所需的文案、多语言描述与**权限用途说明**。
> 商店排名权重：**名称关键词 > 简短描述 > 详情前三行 > 活跃与好评**。

---

## 商店展示信息（中文）

### 扩展名称（45 字符内）
```
Browser Agent - AI 网页自动化与自动填表助手
```

### 简短描述（132 字符内）
```
在侧边栏用自然语言操作浏览器：批量提取网页表格、自动填表、比价与研读。支持 DeepSeek、GPT、Claude、Ollama 本地模型，密钥仅存本机。
```

### 详细描述（精炼痛点 + 杀手级场景 + 隐私安全）
```
Browser Agent 是一款运行在 Chrome 侧边栏的自主 AI 浏览器智能体。用大白话下达任务，AI 会像真人一样打开标签页、浏览点击、输入填表、抓取数据并汇总汇报！

🎯 核心应用场景：
1. 📊 网页数据智能抽取与导出：一键抓取复杂网页表格、电商比价、新闻列表或招聘信息，支持直接导出为结构化 JSON 或 Markdown。
2. ✍️ 复杂多步骤表单自动填写：只需说出需求，AI 智能定位输入框、下拉框、单复选框并自动完成填表，并附带截图复核。
3. 🔍 跨网页深度研读与总结：自动打开多标签页翻页检索、通读长文资讯，快速提炼核心论点与决策依据。
4. 🤖 机械重复性网页操作代劳：自动点击翻页、监测页面动态更新、辅助网页交互测试。

🌟 为什么选择 Browser Agent？
- 🔒 100% 隐私优先与自带 Key（BYOK）：直接连接官方 API（DeepSeek / OpenAI / Claude / OpenRouter）或本地 Ollama / vLLM，API Key 仅存储在您的本机浏览器中，绝不经由任何第三方中间服务器。
- 🛡️ 严格安全门控：每个新域名首次操作必须经由用户授权；预置银行/支付金融黑名单；密码输入、文件上传和脚本执行强制二次确认。
- 👁️ 可靠视觉定位（Set-of-Marks）：截图叠加编号标记框，精准定位复杂按钮与输入框，穿透 Shadow DOM 与 iframe。
- 💰 实时成本与上下文治理：每步动作成本实时核算，内置自动上下文治理与截断机制，避免 Token 浪费。

> 💡 提示：本扩展遵循纯本地与自带 Key（BYOK）模式，请在设置中配置您喜爱的模型服务商 API Key，或启动本地 Ollama 即可开箱即用。
```

---

## 商店展示信息（English / Global）

### Extension Name (Within 45 chars)
```
Browser Agent - AI Automation & Form Filler
```

### Summary / Short Description (Within 132 chars)
```
Automate browser tasks with AI: scrape tables, auto-fill forms, research pages with DeepSeek, GPT, Claude or Ollama. 100% private.
```

### Detailed Description
```
Browser Agent is an autonomous AI web agent living in your Chrome side panel. Instruct it in plain English, and watch it navigate tabs, click, fill forms, extract data, and report back like a human assistant!

🎯 Killer Use Cases:
1. 📊 Smart Web Scraping & Data Extraction: Grab complex web tables, e-commerce pricing, product specs, or job posts into clean JSON/Markdown in seconds.
2. ✍️ Autonomous Form Filling: Simply tell the agent what to input; it identifies textboxes, dropdowns, and checkboxes to complete multi-step forms accurately.
3. 🔍 Deep Research & Cross-Tab Navigation: Let AI open multiple tabs, browse search results, read long articles, and synthesize comparative summaries.
4. 🤖 Repetitive Web Task Automation: Automate pagination, routine page monitoring, and recurring browser workflows right from your sidebar.

🌟 Why Browser Agent?
- 🔒 100% Private & Local-First (BYOK): Direct connection to your preferred provider (DeepSeek, OpenAI, Anthropic, OpenRouter) or local Ollama / vLLM. No proxy servers, zero data leakage. Keys stay strictly in your browser.
- 🛡️ Enterprise-Grade Security: Per-site explicit authorization, built-in financial domain blocklist, and mandatory confirmation for passwords and file uploads.
- 👁️ Robust Visual Perception (Set-of-Marks): Precise UI interaction via numbered bounding boxes; pierces Shadow DOM and nested iframes.
- 💰 Transparent Cost & Context Tracking: Live token accounting, budget governance, and multi-session export (Markdown / JSON).

> 💡 Note: This is a Bring-Your-Own-Key (BYOK) extension. Connect your own API key or local Ollama instance in Settings to get started.
```

---

## 权限用途说明（CWS Review Justification）

| 权限 | 审核理由说明 |
|---|---|
| **`debugger`** | **核心能力**：扩展通过 Chrome DevTools Protocol (CDP) 生成**可信的用户输入事件**（真实鼠标点击、键盘输入）与精准视口截图。普通合成 DOM 事件会被许多现代单页应用和安全防护忽略。附加调试器时顶部始终显示 Chrome 调试横幅，保障透明度。仅在用户明确下发任务且站点被授权后使用，绝不用于监视用户。 |
| **`scripting`** | 向**用户已授权的页面**注入自包含的轻量 DOM 感知函数，收集可交互元素供模型定位与操作。 |
| **`tabs` / `tabGroups`** | 列出/新建/关闭标签页，并把智能体新建的标签页归入「🤖 Agent」独立标签组，便于用户识别与隔离。 |
| **`webNavigation`** | 感知页面导航与帧结构，在动作后等待页面真正加载完成（network-idle）。 |
| **`storage`** | 在本机 `chrome.storage.local` 保存服务商配置、对话历史、站点授权。**不含任何远程服务器存储**。 |
| **`downloads`** | 用户主动导出对话记录（Markdown/JSON）或生成 GIF 时保存到下载目录。 |
| **`sidePanel`** | 扩展的主界面运行在 Chrome 原生侧边栏。 |
| **`host_permissions: <all_urls>`** | 用户需要智能体在任意工作网站上执行任务；但**实际操作前每个站点都必须经用户弹窗逐站授权**，未授权站点不会被读取或操作，且金融支付站点预置禁止。 |

---

## 数据处理声明（Data Safety）
- **收集的数据**：仅包含用户输入的任务指令、已授权网页的文本/截图、对话历史和用户配置的 API Key。
- **传输目的地**：**仅直接发送到用户自行配置的大模型 API 端点**（如 `api.deepseek.com` 或 `localhost:11434`），不经任何开发者服务器（无任何中间服务器）。
- **隐私承诺**：不销售任何用户数据、不用于广告、不追踪用户隐私。
