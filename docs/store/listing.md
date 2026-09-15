# Chrome Web Store Listing / 上架资料与 ASO 优化

> 本文件汇总提交 Chrome Web Store 审核与商店搜索优化（ASO）所需的文案、多语言描述与**权限用途说明**。
> 商店排名权重：**名称关键词 > 简短描述 > 详情前三行 > 活跃与好评**。

---

## 商店展示信息（中文）

### 扩展名称（45 字符内）
```
Browser Agent - 新一代自主 AI 浏览器智能体
```

### 简短描述（132 字符内）
```
新一代自主 AI 浏览器智能体：目标驱动、长程规划与物理级操控。支持主流标准模型端点与本地离线模型，数据仅存本机。
```

### 详细描述（精炼痛点 + 智能体能力 + 隐私安全）
```
Browser Agent 是一款运行在 Chrome 原生侧边栏中的新一代自主 AI 浏览器智能体（Autonomous Web Agent）。给出一个开放目标，智能体自主进行多步规划、跨页探索、物理交互与结果校验，像资深专家一样在纷繁复杂的现代 Web 应用中交付确定性结果。

🚀 核心智能体能力：
1. 🧠 自主长程规划与自检闭环：基于认知架构，自主将复杂需求拆解为行动步骤；动作后实时感知页面变化，遇阻自主重试纠偏，直至通过验收。
2. ⚡ 自动化工作流沉淀为 SKILL：任务完成后一键提炼为高复用技能（自动参数化变量 {{var}}，抽象为自然语言语义步骤）；侧栏抽屉即开即用，支持导入/导出共享。
3. ☁️ 跨设备安全云同步（凭证物理隔离）：基于 Chrome 账号多端实时同步模型配置与技能库；API Key 强制脱敏仅留在本机（chrome.storage.local），绝不上云，公用电脑使用无忧。
4. 🔍 跨页深度调研与信息合成：自主跨多标签页并行检索、阅读长篇文献资料、比对多方数据差异，深度提炼并输出结构化决策研报（Markdown / JSON）。
5. ✍️ 复杂业务流程端到端代劳：跨系统比对信息，自动在现代复杂管理后台中定位多层级表单并执行录入，附带可信物理击键与截图复核。
6. 👁️ 原生系统级物理操控与空间视觉：基于 Chrome 官方 CDP 协议生成真实可信的物理鼠标与键盘事件；搭配 Set-of-Marks 视觉标记框，精准攻克单页应用、Shadow DOM 与动态 iframe。

🔒 本地主权与安全防线（BYOK）：
- 纯正本地主权：直连兼容接口标准的大语言模型端点或本地私有离线模型。您的 API Key 与网页交互数据 100% 保存在本机浏览器中，绝不经由任何第三方中间服务器。
- 凭证物理隔离：配置跨设备同步时 API Key 自动脱敏，敏感 Token 自动净化；内置金融与支付网站安全黑名单；密码输入与敏感操作强制二次确认。
- 透明预算治理：每步操作实时展示 Token 消耗与核算，内置上下文自动压缩机制，防止超出预算。

> 💡 使用提示：本扩展遵循纯本地与自带模型接口（BYOK）模式，请在设置中填入您自备的模型端点地址与密钥，或连接本地离线模型即可开始使用。
```

---

## 商店展示信息（English / Global）

### Extension Name (Within 45 chars)
```
Browser Agent - Autonomous AI Web Copilot
```

### Summary / Short Description (Within 132 chars)
```
Autonomous browser agent: goal planning, reusable SKILLs, cross-device sync & native CDP control with local or custom LLMs. 100% BYOK.
```

### Detailed Description
```
Browser Agent is a next-generation autonomous AI browser agent living directly inside your Chrome side panel. Far more than a simple scraping script, it is equipped with autonomous goal planning, reusable SKILL workflows, secure cross-device sync, and self-correcting validation.

🚀 Agent Superpowers:
1. 🧠 Autonomous Planning & Self-Correction: Decomposes complex missions into structured steps, validates outcomes after every action, and course-corrects dynamically until completion.
2. ⚡ Reusable SKILL Workflows: Turn any completed automation into a parameterized skill with natural language semantic steps; trigger from the sidebar drawer, or import/export via JSON.
3. ☁️ Secure Cross-Device Cloud Sync: Seamlessly sync model configs and skills across your devices via Chrome account; API Keys strictly physically isolated in local storage (never cloud-synced).
4. 🔍 Deep Research & Multi-Tab Synthesis: Traverses multiple tabs, digests lengthy technical pages, reconciles disparate data, and synthesizes structured analytical reports (Markdown / JSON).
5. ✍️ End-to-End Workflow & Form Automation: Cross-references data to complete intricate workflows, administrative dashboards, and multi-step registration forms with trusted inputs.
6. 👁️ Native Physical Control & Spatial Vision: Generates authentic user input events via Chrome DevTools Protocol (CDP); pairs with Set-of-Marks visual bounding boxes to conquer SPAs, nested Shadow DOMs, and dynamic iframes.

🔒 Sovereign Local-First Architecture (Zero-Cloud):
- 100% Private (BYOK): Direct connection to your own standard model endpoints or local offline LLM instances. All API credentials and browsing data remain strictly inside your browser. No intermediary cloud servers, zero data tracking.
- Credential Security: Physical secret isolation on local device; automatic token sanitization for skill variables; built-in financial domain blocklist; mandatory confirmation for sensitive actions.
- Context & Cost Governance: Real-time token usage accounting and automated context governance to eliminate token waste.

> 💡 Getting Started: This is a Bring-Your-Own-Key (BYOK) extension. Connect your own preferred model endpoint or local offline instance in Settings to get started.
```

---

## 权限用途说明（CWS Review Justification）

| 权限 | 审核理由说明 |
|---|---|
| **`debugger`** | **核心能力**：扩展通过 Chrome DevTools Protocol (CDP) 生成**可信的用户输入事件**（真实鼠标点击、键盘输入）与精准视口截图。普通合成 DOM 事件会被许多现代单页应用和安全防护忽略。附加调试器时顶部始终显示 Chrome 调试横幅，保障透明度。仅在用户明确下发任务且站点被授权后使用，绝不用于监视用户。 |
| **`scripting`** | 向**用户已授权的页面**注入自包含的轻量 DOM 感知函数，收集可交互元素供模型定位与操作。 |
| **`tabs` / `tabGroups`** | 列出/新建/关闭标签页，并把智能体新建的标签页归入「🤖 Agent」独立标签组，便于用户识别与隔离。 |
| **`webNavigation`** | 感知页面导航与帧结构，在动作后等待页面真正加载完成（network-idle）。 |
| **`storage`** | 用于保存用户配置、已授权站点和技能库。支持通过 `chrome.storage.sync` 跨设备同步配置与技能（API Key 经脱敏处理，强制保存在本地 `chrome.storage.local`，绝不上云）。**不含任何外部远程服务器存储**。 |
| **`downloads`** | 用户主动导出对话记录（Markdown/JSON）或生成 GIF 时保存到下载目录。 |
| **`sidePanel`** | 扩展的主界面运行在 Chrome 原生侧边栏。 |
| **`host_permissions: <all_urls>`** | 用户需要智能体在任意工作网站上执行任务；但**实际操作前每个站点都必须经用户弹窗逐站授权**，未授权站点不会被读取或操作，且金融支付站点预置禁止。 |

---

## 数据处理声明（Data Safety）
- **收集的数据**：仅包含用户输入的任务指令、已授权网页的文本/截图、对话历史和用户配置的 API Key。
- **传输目的地**：**仅直接发送到用户自行配置的大模型 API 端点**（如 `api.deepseek.com` 或 `localhost:11434`），不经任何开发者服务器（无任何中间服务器）。
- **隐私承诺**：不销售任何用户数据、不用于广告、不追踪用户隐私。
