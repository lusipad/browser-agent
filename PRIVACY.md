# Privacy Policy / 隐私政策

_Last updated / 最后更新：2026-07-19_

---

## English

Browser Agent ("the extension") is an AI browser agent that runs in the Chrome sidebar. This policy explains what data the extension processes.

**Core principle: the extension has no developer backend. Your data is only sent where you configure it — your chosen model endpoint.**

### Data Processed

| Data | Purpose | Storage |
|---|---|---|
| API key / provider config | Call your configured model endpoint | Local only (`chrome.storage.local`) |
| Conversations & session history | Display and resume conversations | Local only (`chrome.storage.local` / `session`) |
| Page content & screenshots (authorized pages) | Sent as context to your model for decision-making | Sent to your configured endpoint; not stored elsewhere |
| Site authorization records | Enforce per-site permission policy | Local only (`chrome.storage.local`) |

### Where Data Goes

- **Only to the model endpoint you configure** (OpenAI / DeepSeek / OpenRouter / Ollama / any OpenAI-compatible). Requests go directly from your browser — **no intermediary server**.
- Sent content includes: your instructions, authorized page text/structure, screenshots (vision models), and tool call results.
- **The model provider's own privacy policy applies** to data sent to them. Review your provider's terms.
- The extension has **no developer backend** — nothing is sent to the extension author or any third-party analytics/advertising service.

### What the Extension Does NOT Do

- ❌ No telemetry, usage statistics, or crash analytics
- ❌ No ads, trackers, or third-party SDKs
- ❌ Does not upload your API key, browsing history, or page content to any developer server
- ❌ Does not read or operate on pages you haven't authorized

### Your Controls

- **Per-site authorization**: each site requires your approval before any interaction
- **Financial blocklist**: banks, payment, exchanges pre-blocked (configurable)
- **Sensitive confirmations**: password input, JS execution, file upload require per-action approval
- **`javascript_tool` off by default**: must be explicitly enabled in Advanced settings
- **Delete anytime**: remove sessions in the history drawer; uninstalling clears all local data

### Data Retention

All data is stored exclusively in your browser's local storage, under your full control. Deleting sessions or uninstalling the extension erases the corresponding data. The developer cannot access or recover any of your data.

### Contact

This extension is open source: <https://github.com/lusipad/browser-agent>. File an issue for questions or concerns.

---

## 中文

Browser Agent（下称"本扩展"）是一个在浏览器侧边栏运行的 AI 浏览器智能体。本政策说明本扩展处理哪些数据。

**核心原则：本扩展没有自己的服务器，不收集任何数据到开发者处。你的数据只按你的配置发往你自己选择的大模型服务。**

### 处理的数据

| 数据 | 用途 | 存放位置 |
|---|---|---|
| API Key / 服务商配置 | 调用你配置的大模型接口 | 仅本机 `chrome.storage.local` |
| 对话内容、会话历史 | 展示与续接对话 | 仅本机 `chrome.storage.local` / `session` |
| 页面内容与截图（已授权页面） | 作为上下文发给你的模型供决策 | 随请求发往你配置的端点，不另存 |
| 站点授权记录 | 执行逐站授权策略 | 仅本机 `chrome.storage.local` |

### 数据发往哪里

- **只发往你在设置里配置的大模型接口**（OpenAI / DeepSeek / OpenRouter / Ollama / 任意 OpenAI 兼容端点）。请求直接从浏览器发出，**不经任何中间服务器**。
- 发送内容：你的指令、已授权页面的文本/结构、截图（视觉模型）、工具调用结果。
- **对发送到大模型服务的数据，适用该服务商自己的隐私政策。**
- 本扩展**没有开发者后端**，不会把任何数据发送给开发者或任何第三方。

### 本扩展不做什么

- ❌ 不收集遥测、使用统计或崩溃分析
- ❌ 不含广告、追踪器或第三方 SDK
- ❌ 不上传 API Key、浏览历史或页面内容到开发者服务器
- ❌ 不在未授权的站点上读取或操作页面

### 你的控制权

- **逐站授权**：每个站点首次被操作前需你批准
- **金融黑名单**：银行、支付、交易所预置禁止（可配置）
- **敏感确认**：密码输入 / JS 执行 / 文件上传需逐次确认
- **`javascript_tool` 默认关闭**：需在「高级」显式开启
- **随时删除**：在历史抽屉中删除会话；卸载扩展清除全部本机数据

### 数据留存

所有数据仅保存在你本机的浏览器存储中，由你完全掌控。删除会话或卸载扩展即清除数据。开发者无法访问、无法恢复你的任何数据。

### 联系方式

本扩展为开源项目：<https://github.com/lusipad/browser-agent>。问题或疑虑请在仓库提交 Issue。

---

_本扩展按"现状"提供。你需自行对配置的第三方大模型服务及其数据处理负责。_

_This extension is provided "as is". You are responsible for the third-party model services you configure and their data handling._
