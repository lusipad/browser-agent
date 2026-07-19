# Architecture / 架构详解

[English](#english) | [中文](#中文)

---

## English

### Overview

Browser Agent is a Chrome MV3 extension that turns the sidebar into a natural-language browser automation interface. The architecture is split into four execution contexts:

```
┌─────────────────────────────────────────────────────────┐
│  Background Service Worker (agent loop, CDP, tools)     │
├─────────────────────────────────────────────────────────┤
│  Sidebar (React) ←→ message passing ←→ Background      │
├─────────────────────────────────────────────────────────┤
│  Options Page (React) ←→ chrome.storage                 │
├─────────────────────────────────────────────────────────┤
│  Content Scripts (injected perception functions)        │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Perception Layer**

- DOM collector recursively pierces **open Shadow DOM** and **same-origin iframes**
- `topRect()` converts element coordinates along the frame chain to top-level viewport space — cross-frame clicks land accurately
- Cross-origin iframes are marked as a single clickable region (text readable via `get_page_text`)
- Perception functions are fully self-contained (no module-level references), injected via `chrome.scripting` into an isolated world
- The ref registry is attached to the isolated world and automatically invalidated on navigation

**Set-of-marks**

- Numbered bounding boxes overlaid on screenshots map 1:1 to element refs
- The model "clicks by number" — the most reliable visual grounding approach, far better than raw coordinates
- Can be disabled in Advanced settings for models that work better with text-only perception

**Planner + Validator**

- At task start, the model decomposes into steps with explicit success criteria
- When the model signals completion, a validation pass checks current page state against the criteria
- If validation fails, the agent continues automatically (with an iteration cap)

**Context Governance** (modeled after browser-use's MessageManager)

- Before each API request, history is budget-trimmed by estimated token count
- Always preserves: system prompt + original task message + latest full turn
- Drops oldest messages first; oversized `read_page`/`get_page_text` results get mid-section compression
- Strictly maintains `tool_use`/`tool_result` pairing (avoids OpenAI orphan rejection)
- Uses model-reported context window when available, falls back to global default

**Network Resilience**

- Pre-stream exponential backoff retry for 5xx / 429 / network errors
- Never retries after stream reading begins (prevents duplicate output)
- Errors classified into user-friendly messages (Chinese/English based on locale)

**Session & History**

- Active session persisted to `chrome.storage.session` (survives service worker restarts)
- Completed sessions archived to `chrome.storage.local` with screenshots stripped (quota control)
- 100-conversation cap with oldest eviction

### Module Map

```
src/
  shared/
    types.ts           Core type definitions (messages, config, tools)
    settings.ts        Default config, model registry with pricing
    prompts.ts         System prompt generation (with anti-injection defense)
    context.ts         Token estimation, budget trimming, cost calculation
    util.ts            Shared utilities (deriveTitle, etc.)
    i18n.ts            Runtime i18n engine
    i18n/              Area-split dictionaries (sidepanel, options, background)
    i18nReact.tsx      React context + useT() hook

  providers/
    types.ts           HttpError, fetchWithRetry, classifyProviderError
    openai.ts          OpenAI-compatible streaming adapter

  background/
    index.ts           Message router, lifecycle management
    agent.ts           Model ↔ tool loop, context governance dispatch
    session.ts         Per-window session state
    history.ts         Multi-session archive (list/switch/delete)
    cdp.ts             chrome.debugger wrapper (screenshots, input, console/network)
    reader.ts          Injected DOM perception & action functions
    tabs.ts            Tab management, Agent tab group
    permissions.ts     Per-site authorization, approval card rendering
    diagnose.ts        One-click diagnostics panel logic
    tools/
      registry.ts      Tool dispatch with site auth gating
      page.ts          read_page, find, extract_data, get_page_text, wait_for
      browser.ts       navigate, tabs_*, computer, form_input, scroll_to_ref
      devtools.ts      javascript_tool, read_console, read_network

  sidepanel/
    App.tsx            Main app shell with i18n provider
    components/        Timeline, Header, Composer, HistoryDrawer, ExportMenu
    export.ts          Markdown/JSON export logic

  options/
    Options.tsx        Settings app shell
    panels/            Provider, Models, Security, Sites, Advanced, Diagnose
```

### Internal Message Format

Messages use Anthropic-style content blocks internally. The OpenAI adapter converts between formats:
- `tool_use` ↔ `tool_calls`
- Screenshots from tool messages are moved to subsequent user messages (OpenAI requirement)

### Permissions (manifest)

`debugger` (trusted input & screenshots), `scripting` (inject perception), `tabs`/`tabGroups`, `storage`, `sidePanel`, `downloads`, `webNavigation`, `<all_urls>`.

---

## 中文

### 概览

Browser Agent 是一个 Chrome MV3 扩展，将侧边栏变为自然语言浏览器自动化界面。架构分为四个执行上下文：

```
┌─────────────────────────────────────────────────────────┐
│  后台 Service Worker（智能体循环、CDP、工具）            │
├─────────────────────────────────────────────────────────┤
│  侧边栏（React）←→ 消息传递 ←→ 后台                    │
├─────────────────────────────────────────────────────────┤
│  设置页（React）←→ chrome.storage                       │
├─────────────────────────────────────────────────────────┤
│  内容脚本（注入的感知函数）                              │
└─────────────────────────────────────────────────────────┘
```

### 关键设计决策

**感知层**

- DOM 收集器递归穿透**开放 Shadow DOM** 与**同源 iframe**
- `topRect()` 沿帧链将元素坐标换算到顶层文档视口，跨帧点击也能落准
- 跨域 iframe 作为整体可点区域标记（文本可通过 `get_page_text` 读取）
- 感知函数完全自包含（不引用模块级标识符），通过 `chrome.scripting` 注入隔离世界
- ref 注册表挂在隔离世界，导航后自动失效

**Set-of-marks**

- 截图上叠加编号框，编号与元素 ref 一一对应
- 模型「按编号点击」— 视觉 grounding 最可靠的方式，远胜裸坐标
- 可在高级设置中关闭（适合纯文本感知的模型）

**Planner + Validator**

- 任务开始时模型拆解步骤并定「成功判据」
- 模型表示完成时，验证器对当前页面状态自检
- 自检未通过则自动继续（有上限）

**上下文治理**（对标 browser-use MessageManager）

- 每次 API 请求前按估算 token 预算裁剪历史
- 始终保留：系统提示 + 原始任务 + 最近一整轮
- 从最旧开始丢弃；超长 `read_page`/`get_page_text` 结果压缩中段
- 严格维持 `tool_use`/`tool_result` 配对（避免 OpenAI 拒绝孤儿）
- 优先用模型自报上下文窗口，缺省回落全局兜底值

**网络健壮性**

- 连接阶段对 5xx/429/网络错误做指数退避重试
- 开始读流后绝不重试（防重复输出）
- 错误按类型分类为用户友好提示（中/英根据语言设置）

**会话与历史**

- 活跃会话持久化到 `chrome.storage.session`（Service Worker 重启可恢复）
- 完成的会话归档到 `chrome.storage.local`，截图剥离（配额控制）
- 100 会话上限，最旧淘汰

### 权限说明（manifest）

`debugger`（可信输入与截图）、`scripting`（注入感知函数）、`tabs`/`tabGroups`、`storage`、`sidePanel`、`downloads`、`webNavigation`、`<all_urls>`。
