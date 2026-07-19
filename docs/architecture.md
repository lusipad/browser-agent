# Architecture / 架构设计

[English](#english) | [中文](#中文)

---

## English

### System Overview

Browser Agent is a Chrome MV3 extension with four execution contexts communicating via message passing and shared storage:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Background Service Worker                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │
│  │ Agent Loop│←→│   CDP     │←→│  Reader   │  │  Tool Registry    │   │
│  │(Planner/  │  │(debugger) │  │(inject)   │  │(authorize→exec→   │   │
│  │ Validator)│  └───────────┘  └───────────┘  │ auto-screenshot)  │   │
│  └─────┬─────┘                                └───────────────────┘   │
│        │              ┌───────────┐                                     │
│        └──────────────│ Provider  │ ← SSE stream to model endpoint     │
│                       │(OpenAI)   │                                     │
│                       └───────────┘                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Sidebar (React)              │  Options Page (React)                    │
│  - Timeline                   │  - Providers / Models                   │
│  - Composer                   │  - Safety / Sites                       │
│  - Approval cards             │  - Advanced / Diagnostics               │
│  - History drawer             │                                         │
│  - Export menu                │                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Content Scripts (isolated world injection via chrome.scripting)         │
│  - pageAgent(): self-contained DOM perception/action                    │
│  - Pierces open Shadow DOM + same-origin iframes                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow (One Turn)

```
User types task in sidebar
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. PanelToBg {type:"send", text} → Background via chrome.runtime.Port │
│ 2. Session pushes user message to history                              │
│ 3. [Planner] (first turn only): model generates plan + SUCCESS criteria│
│ 4. [Navigator loop]:                                                   │
│    a. governContext() → budget-trim history                            │
│    b. openaiStream() → SSE to model endpoint                          │
│    c. Stream text deltas to sidebar (real-time)                        │
│    d. If tool_use blocks returned:                                     │
│       - resolveTab → ensureSiteAllowed (approval card if needed)       │
│       - addToAgentGroup (blue tab group)                               │
│       - execute tool → return tool_result                              │
│       - auto-screenshot if configured                                  │
│       → back to (a) for next iteration                                 │
│    e. If no tool_use (model done):                                     │
│       → [Validator] checks page state vs. success criteria             │
│       → if failed: inject "not complete" message, continue loop        │
│       → if passed: emit ✅, break                                     │
│ 5. Session persists to chrome.storage.session                          │
│ 6. Conversation archived to chrome.storage.local when switching/reset  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Dependency Graph

```
shared/types.ts ←── Everything depends on this (zero external imports)
       │
       ├── shared/settings.ts ← Default config, model registry
       ├── shared/prompts.ts  ← System prompt builder
       ├── shared/context.ts  ← Token estimation, budget trimming, cost
       ├── shared/i18n.ts     ← Runtime translation engine
       │     └── shared/i18n/{sidepanel,options,background}.ts (dictionaries)
       └── shared/util.ts     ← uid, truncate, hostMatches, deriveTitle...

providers/types.ts ← StreamParams, ToolSpec, fetchWithRetry, HttpError
       │
       └── providers/openai.ts ← The single adapter (covers all OAI-compat)
              └── providers/sse.ts ← Async iterator over ReadableStream SSE

background/
       ├── index.ts       ← Entry: tool registration, port management, message router
       ├── agent.ts       ← runTurn(): Planner → Navigator loop → Validator
       ├── session.ts     ← Per-window state, persist/restore, approval interface
       ├── history.ts     ← Archive/load/delete/list conversations
       ├── cdp.ts         ← chrome.debugger wrapper (attach/detach, sendCommand)
       ├── screenshot.ts  ← CDP Page.captureScreenshot → scale → mark overlay → JPEG
       ├── marks.ts       ← Pure geometry: CSS rect → canvas pixel, filter, cap
       ├── reader.ts      ← pageAgent() function injected into pages
       ├── inject.ts      ← chrome.scripting.executeScript wrapper
       ├── permissions.ts ← Site authorization + sensitive action confirmation
       ├── tabs.ts        ← Tab CRUD + Agent tab group management
       ├── diagnose.ts    ← One-click diagnostics (CDP, screenshot, elements, frames)
       ├── gif.ts         ← GIF frame buffer
       └── tools/
              ├── registry.ts ← Tool definition interface, dispatch, site auth gate
              ├── browser.ts  ← navigate, tabs_*, resize_window, screenshot
              ├── computer.ts ← CDP mouse/keyboard (click, type, scroll, drag)
              ├── page.ts     ← read_page, find, extract_data, wait_for, get_page_text
              ├── devtools.ts ← javascript_tool, read_console, read_network
              └── gif.ts      ← gif_creator tool

sidepanel/
       ├── main.tsx / App.tsx ← React root with I18nProvider
       ├── port.ts            ← chrome.runtime.connect to background
       ├── markdown.ts        ← marked wrapper for assistant text rendering
       ├── export.ts          ← toMarkdown / toJson / download
       └── components/
              ├── Timeline.tsx      ← Renders TimelineItem[] (user/assistant/tool/approval/info)
              ├── Header.tsx        ← Model picker, cost display, context meter, export
              ├── Composer.tsx      ← Text input + send/abort button
              ├── HistoryDrawer.tsx ← Session list with switch/delete/new
              ├── ExportMenu.tsx    ← Markdown/JSON dropdown
              └── toolMeta.ts      ← Icon + label for each tool name

options/
       ├── main.tsx / Options.tsx ← React root, tab navigation
       └── panels/
              ├── ProvidersPanel.tsx   ← Add/edit/delete provider endpoints
              ├── ModelsPanel.tsx      ← Model configs (pricing, vision, context window)
              ├── SafetyPanel.tsx      ← Toggle confirmations, allowAllSites
              ├── SitesPanel.tsx       ← Allowed/blocked host lists
              ├── AdvancedPanel.tsx    ← iterations, screenshots, retry, SoM, planning, lang
              └── DiagnosticsPanel.tsx ← One-click tab health check
```

### Key Design Decisions

#### 1. Perception Layer (`reader.ts`)

The core challenge: reliably identifying and interacting with web page elements across the full diversity of modern web apps.

**Approach:**
- A single `pageAgent(cmd, payload)` function is injected via `chrome.scripting.executeScript` into an **isolated world** (ID 7734)
- The function is **100% self-contained** — no imports, no module-level references — because Chrome serializes it as a string before injection
- It recursively walks the DOM tree, descending into open `shadowRoot` and same-origin `<iframe>` documents
- Each interactive element gets a numeric `ref` stored in a WeakMap-backed registry (`globalThis.__ba`)
- `topRect()` converts each element's local `getBoundingClientRect()` to the top-level document's viewport coordinate space by walking up the frame chain and accumulating border/padding offsets

**Why isolated world?** The extension's ref registry lives in a separate JS world from the page's own scripts — page code can't interfere with refs, and navigation automatically invalidates stale entries.

#### 2. Set-of-marks (`marks.ts` + `screenshot.ts`)

**Problem:** LLMs are unreliable at clicking precise pixel coordinates from screenshots alone.

**Solution:** After capturing a screenshot via CDP, we overlay colored numbered boxes on every visible interactive element. The number IS the element's ref. The model says "click ref 7" instead of guessing coordinates.

**Pipeline:**
1. `reader.ts` collects elements with their top-level viewport rects
2. `marks.ts` (pure geometry, easily unit-tested) maps CSS rects → canvas pixel rects, filters out too-small / too-large / off-screen elements, and caps at 60
3. `screenshot.ts` captures via CDP `Page.captureScreenshot`, decodes the PNG, draws colored boxes + labels using a software rasterizer (no Canvas API needed in service worker), re-encodes as JPEG

#### 3. CDP Trusted Input (`cdp.ts` + `tools/computer.ts`)

**Problem:** Synthetic DOM events (`element.click()`, `dispatchEvent`) are ignored by many modern frameworks and anti-bot protections.

**Solution:** All mouse/keyboard actions go through Chrome DevTools Protocol:
- `Input.dispatchMouseEvent` for clicks, hover, drag
- `Input.insertText` for typing (bypasses IME complications)
- `Input.dispatchKeyEvent` for special keys (Enter, Tab, shortcuts)
- `Page.captureScreenshot` for screenshots (works even when tab is in background)

Chrome shows a yellow "debugger" banner whenever CDP is attached — this is the user's visual indicator that the extension is operating on that tab.

#### 4. Context Governance (`context.ts`)

**Problem:** Long agent tasks accumulate massive message histories (screenshots, tool results) that overflow the model's context window. OpenAI rejects messages with orphaned `tool_result` blocks (no matching `tool_use`).

**Solution** (inspired by browser-use's MessageManager):
1. **Compress oversized tool results** — `read_page`/`get_page_text` outputs exceeding 8000 chars get mid-section ellipsis (preserve head 60% + tail 40%)
2. **Trim images** — only keep the N most recent screenshots; older ones → placeholder text
3. **Budget history** — estimate total tokens (chars/3.2 for text, ~1400 per image); drop oldest messages until within budget
4. **Invariants preserved:**
   - `messages[0]` (original user task) is never dropped
   - The last complete assistant turn is never dropped
   - A `tool_result` carrier message is never the first in the trimmed window (prevents orphans)
   - A notice `[earlier steps trimmed]` is injected so the model knows context was lost

**No tiktoken dependency** — the extension environment can't load native WASM modules reliably. The char/3.2 heuristic is conservative (overestimates tokens → never overflows).

#### 5. Agent Loop Architecture (`agent.ts`)

The loop implements a **Planner → Navigator → Validator** pattern (inspired by Nanobrowser):

```
                    ┌──────────────────────────────────┐
                    │         PLANNER (optional)        │
                    │ Breaks task into ≤6 steps,       │
                    │ outputs SUCCESS: <criterion>      │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
               ┌───→│         NAVIGATOR (loop)         │
               │    │ governContext → stream → tools    │
               │    │ maxIterations cap                 │
               │    └──────────────┬───────────────────┘
               │                   │ model stops calling tools
               │    ┌──────────────▼───────────────────┐
               │    │         VALIDATOR                 │
               │    │ Fresh screenshot/read_page        │
               │    │ + success criteria → done?        │
               │    └──────────────┬───────────────────┘
               │                   │
               │         ┌─────────┴─────────┐
               │         │                   │
               │     done=true           done=false
               │      (break)         (inject feedback,
               └──────────────────── continue loop)
                    (max 2 validator retries)
```

**Continuation:** When the user hits the iteration cap and clicks "Continue", a new `runTurn` is called with `continuation: true` — no new user message is added, and the original task is reused as the success criterion.

#### 6. Provider Adapter (`providers/openai.ts`)

A single adapter covers ALL OpenAI-compatible endpoints because:
- The OpenAI Chat Completions API has become the de facto standard
- DeepSeek, OpenRouter, Ollama, vLLM, LM Studio all implement it
- The user explicitly rejected multi-provider adapters (Anthropic/Gemini native)

**Key behaviors:**
- Streaming via SSE with `stream_options: { include_usage: true }`
- Rejects HTTP 200 responses that are not `text/event-stream`, so a missing `/v1` path is reported as endpoint misconfiguration instead of an empty model response
- Tool calls accumulated across delta chunks (handles fragmented `function.arguments`)
- Reasoning models (o-series, gpt-5) get `max_completion_tokens` instead of `max_tokens` and no `temperature`
- Screenshots moved from tool results to subsequent user messages (OpenAI doesn't support images in tool role)
- Consecutive same-role messages merged before sending (some endpoints reject adjacent user messages)

#### 7. Network Resilience (`providers/types.ts`)

```
fetchWithRetry()
  ├── Attempt request
  ├── If 5xx / 429 / 408 / network error:
  │     delay = min(1000 * 2^attempt + jitter, 8000)
  │     retry up to maxRetries times
  ├── If 401 / 403 / 404 / other 4xx:
  │     throw immediately (not retryable)
  └── On success:
        return Response (caller reads stream)
        ← NEVER retry after stream reading begins
```

`classifyProviderError()` maps errors to user-friendly messages:
- 401 → "API Key 无效或已过期"
- 404 → "模型不存在"
- 429 → "请求过于频繁，请稍后重试"
- 5xx → "服务暂时不可用"
- Timeout → "请求超时"
- Network → "网络连接失败"

#### 8. Security Model (`permissions.ts`)

Three layers:
1. **Blocklist** — hosts matching `sites.blocked` patterns are unconditionally rejected (throws error visible to model)
2. **Per-site authorization** — unknown hosts trigger an approval card in the sidebar; user chooses allow-once / allow-always / deny
3. **Sensitive action confirmation** — password input / JS execution / file upload each have independent toggles and trigger approval cards

The `ApprovalHost` interface decouples the permission logic from the Session class to avoid circular imports and enable unit testing.

#### 9. Session Lifecycle (`session.ts` + `history.ts`)

```
┌─────────────────────────────────────────────────────────────┐
│ Active Session (per browser window)                          │
│ - messages[] (Anthropic-style content blocks)               │
│ - timeline[] (UI rendering items)                            │
│ - persisted to chrome.storage.session (survives SW restart) │
└─────────────────────────┬───────────────────────────────────┘
                          │ on new_chat / switch_conv
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Archive (chrome.storage.local)                               │
│ - Screenshots stripped (base64 → placeholder) for quota     │
│ - Max 100 conversations, oldest evicted                     │
│ - Metadata: id, title (derived from first user msg), time   │
└─────────────────────────────────────────────────────────────┘
```

Session persistence handles quota exhaustion gracefully: if `chrome.storage.session.set()` fails (quota), it retries once with all images stripped.

#### 10. i18n (`shared/i18n.ts` + `shared/i18nReact.tsx`)

**Design constraints:**
- No external dependency (no i18next)
- Must work in service worker (no DOM), React components, and options page
- Area-split dictionaries avoid merge conflicts when multiple people edit

**Architecture:**
- `translate(lang, key, params)` — core function, works everywhere
- `makeT(lang)` — curried helper for background scripts
- `I18nProvider` + `useT()` — React context + hook for UI components
- `resolveLang(setting)` — resolves 'auto' to 'zh'|'en' based on `navigator.language`
- Manifest uses Chrome's built-in `_locales/` for store listing localization

#### 11. Message Protocol

The sidebar and background communicate via a long-lived `chrome.runtime.Port`:

**Panel → Background (`PanelToBg`):**
- `hello` (with windowId) — initialize session
- `send` — user typed a message
- `continue` — resume after iteration cap
- `abort` — stop the agent
- `set_model` — switch model
- `approval` — user responded to approval card
- `switch_conv` / `delete_conv` / `new_chat` — history management
- `detach` — release control (ungroup tabs, detach CDP)

**Background → Panel (`BgToPanel`):**
- `snapshot` — full state dump (on connect)
- `item_upsert` — add/update a timeline item
- `text_delta` — streaming text chunk
- `run_state` — agent running/stopped
- `conversations` — history list update
- `models` — available model list
- `usage` — token counts, cost, context usage

### Build System

```bash
node build.mjs [--watch]
```

Single esbuild script producing:
- `dist/background.js` — service worker bundle (ESM, single file)
- `dist/sidepanel.js` + `dist/sidepanel.html` — sidebar React app
- `dist/options.js` + `dist/options.html` — options React app
- `dist/public/` — static assets (icons, CSS, manifest)

No webpack, no Vite — just esbuild for sub-second builds.

---

## 中文

### 系统概览

Browser Agent 是一个 Chrome MV3 扩展，四个执行上下文通过消息传递和共享存储通信：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        后台 Service Worker                               │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │
│  │ 智能体循环│←→│   CDP     │←→│   Reader  │  │   工具注册表      │   │
│  │(规划/     │  │(debugger) │  │(注入)     │  │(授权→执行→        │   │
│  │ 验证)     │  └───────────┘  └───────────┘  │ 自动截图)         │   │
│  └─────┬─────┘                                └───────────────────┘   │
│        │              ┌───────────┐                                     │
│        └──────────────│  Provider │ ← SSE 流式到模型端点               │
│                       │(OpenAI)   │                                     │
│                       └───────────┘                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  侧边栏 (React)             │  设置页 (React)                           │
│  - 时间线                    │  - 服务商 / 模型                         │
│  - 输入框                    │  - 安全 / 站点                           │
│  - 审批卡片                  │  - 高级 / 诊断                           │
│  - 历史抽屉                  │                                          │
│  - 导出菜单                  │                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  内容脚本（隔离世界注入，通过 chrome.scripting）                         │
│  - pageAgent(): 自包含 DOM 感知/操作函数                                │
│  - 穿透开放 Shadow DOM + 同源 iframe                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 数据流（一次对话轮次）

```
用户在侧边栏输入任务
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. PanelToBg {type:"send", text} → 后台（chrome.runtime.Port）  │
│ 2. Session 将用户消息推入历史                                    │
│ 3. [规划器]（仅首轮）: 模型生成计划 + SUCCESS 判据              │
│ 4. [执行器循环]:                                                │
│    a. governContext() → 按预算裁剪历史                           │
│    b. openaiStream() → SSE 到模型端点                           │
│    c. 文本增量实时推送侧边栏                                     │
│    d. 若返回 tool_use 块:                                       │
│       - resolveTab → ensureSiteAllowed（需要时弹审批卡片）       │
│       - addToAgentGroup（蓝色标签组）                            │
│       - 执行工具 → 返回 tool_result                             │
│       - 若配置了自动截图则附带新截图                              │
│       → 回到 (a) 下一迭代                                       │
│    e. 若无 tool_use（模型认为完成）:                             │
│       → [验证器] 检查页面状态 vs. 成功判据                      │
│       → 未通过: 注入"未完成"消息，继续循环                      │
│       → 通过: 发出 ✅，跳出                                    │
│ 5. Session 持久化到 chrome.storage.session                      │
│ 6. 切换/重置时归档到 chrome.storage.local                       │
└─────────────────────────────────────────────────────────────────┘
```

### 关键设计决策

#### 1. 感知层（`reader.ts`）

核心挑战：在现代 Web 应用的多样性下，可靠地识别和操作页面元素。

**方案：**
- 单个 `pageAgent(cmd, payload)` 函数通过 `chrome.scripting.executeScript` 注入**隔离世界**（ID 7734）
- 函数**100% 自包含** — 无 import、无模块级引用 — 因为 Chrome 会将其序列化为字符串再注入
- 递归遍历 DOM 树，深入开放 `shadowRoot` 和同源 `<iframe>` 文档
- 每个可交互元素获得数字 `ref`，存储在 WeakMap 支撑的注册表中（`globalThis.__ba`）
- `topRect()` 将每个元素的本地 `getBoundingClientRect()` 沿 frame 链换算到顶层文档视口坐标空间

**为什么用隔离世界？** 扩展的 ref 注册表运行在与页面脚本不同的 JS 世界 — 页面代码无法干扰 ref，导航自动失效旧条目。

#### 2. Set-of-marks（`marks.ts` + `screenshot.ts`）

**问题：** LLM 仅凭截图点击精确像素坐标非常不可靠。

**方案：** 通过 CDP 截图后，在每个可见可交互元素上叠加彩色编号框。编号就是元素的 ref。模型说"点击 ref 7"而非猜测坐标。

**流水线：**
1. `reader.ts` 收集元素及其顶层视口矩形
2. `marks.ts`（纯几何，可单测）将 CSS 矩形 → 画布像素矩形，过滤过小/过大/不可见，上限 60 个
3. `screenshot.ts` 通过 CDP 截图 → 解码 PNG → 软件光栅化绘制编号框 → 重编码 JPEG

#### 3. CDP 可信输入（`cdp.ts` + `tools/computer.ts`）

**问题：** 合成 DOM 事件（`element.click()`、`dispatchEvent`）会被很多现代框架和反机器人防护忽略。

**方案：** 所有鼠标/键盘操作通过 Chrome DevTools Protocol：
- `Input.dispatchMouseEvent` — 点击、悬停、拖拽
- `Input.insertText` — 输入文本（绕过 IME 复杂性）
- `Input.dispatchKeyEvent` — 特殊键（Enter、Tab、快捷键）
- `Page.captureScreenshot` — 截图（标签页在后台也能用）

Chrome 在 CDP 附加时会显示黄色 "debugger" 横幅 — 这是用户的视觉指示器。

#### 4. 上下文治理（`context.ts`）

**问题：** 长任务积累大量消息历史（截图、工具结果）溢出模型上下文窗口。OpenAI 拒绝孤儿 `tool_result` 块。

**方案**（灵感来自 browser-use MessageManager）：
1. **压缩超长工具结果** — 超 8000 字符的 `read_page`/`get_page_text` 输出做中段省略（保头 60% + 尾 40%）
2. **裁剪图片** — 仅保留最近 N 张截图，更早的 → 占位文本
3. **预算历史** — 估算总 token（文本 chars/3.2，图片 ~1400）；从最旧开始丢弃直到预算内
4. **不变量：**
   - `messages[0]`（原始用户任务）永不丢弃
   - 最后一个完整 assistant 轮次永不丢弃
   - `tool_result` 载体消息永不作为裁剪窗口的第一条（防孤儿）
   - 注入 `[earlier steps trimmed]` 通知模型上下文被截断

**无 tiktoken 依赖** — 扩展环境不能可靠加载原生 WASM 模块。chars/3.2 启发式偏保守（高估 token → 不会溢出）。

#### 5. 智能体循环（`agent.ts`）

实现 **Planner → Navigator → Validator** 模式（灵感来自 Nanobrowser）：

```
                    ┌──────────────────────────────────┐
                    │        规划器 (可选)              │
                    │ 任务拆解为 ≤6 步，               │
                    │ 输出 SUCCESS: <判据>             │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
               ┌───→│        执行器 (循环)             │
               │    │ 上下文治理 → 流式 → 工具执行     │
               │    │ maxIterations 上限               │
               │    └──────────────┬───────────────────┘
               │                   │ 模型停止调用工具
               │    ┌──────────────▼───────────────────┐
               │    │        验证器                     │
               │    │ 新鲜截图/read_page               │
               │    │ + 成功判据 → 完成了吗？          │
               │    └──────────────┬───────────────────┘
               │                   │
               │         ┌─────────┴─────────┐
               │         │                   │
               │     done=true          done=false
               │      (跳出)          (注入反馈,
               └──────────────────── 继续循环)
                    (最多 2 次验证重试)
```

#### 6. 供应商适配器（`providers/openai.ts`）

一个适配器覆盖所有 OpenAI 兼容端点，因为：
- OpenAI Chat Completions API 已成事实标准
- DeepSeek、OpenRouter、Ollama、vLLM、LM Studio 都实现了它
- 用户明确拒绝了多供应商适配器（Anthropic/Gemini 原生）

**关键行为：**
- 通过 SSE 流式传输，带 `stream_options: { include_usage: true }`
- 拒绝 Content-Type 非 `text/event-stream` 的 HTTP 200 响应，因此 Base URL 缺少 `/v1` 时会明确报告端点配置错误，而不是误报模型空响应
- 工具调用跨多个 delta chunk 累积（处理分片的 `function.arguments`）
- 推理模型（o系列、gpt-5）用 `max_completion_tokens` 而非 `max_tokens`，不设 `temperature`
- 截图从工具结果移到后续 user 消息（OpenAI 不支持 tool 角色的图片）
- 相邻同角色消息合并后发送（某些端点拒绝连续 user 消息）

#### 7. 网络健壮性（`providers/types.ts`）

```
fetchWithRetry()
  ├── 发起请求
  ├── 若 5xx / 429 / 408 / 网络错误:
  │     delay = min(1000 * 2^attempt + jitter, 8000)
  │     最多重试 maxRetries 次
  ├── 若 401 / 403 / 404 / 其他 4xx:
  │     立即抛出（不可重试）
  └── 成功:
        返回 Response（调用方读流）
        ← 开始读流后绝不重试
```

#### 8. 安全模型（`permissions.ts`）

三层防护：
1. **黑名单** — 匹配 `sites.blocked` 的 host 无条件拒绝（抛错让模型看到）
2. **逐站授权** — 未知 host 在侧边栏触发审批卡片；用户选择仅本次/始终/拒绝
3. **敏感操作确认** — 密码输入/JS执行/文件上传各有独立开关和审批卡片

#### 9. 会话生命周期（`session.ts` + `history.ts`）

```
┌─────────────────────────────────────────────────────────────┐
│ 活跃会话（每个浏览器窗口一个）                               │
│ - messages[]（Anthropic 风格 content blocks）               │
│ - timeline[]（UI 渲染项）                                    │
│ - 持久化到 chrome.storage.session（SW 重启可恢复）          │
└─────────────────────────┬───────────────────────────────────┘
                          │ new_chat / switch_conv
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 归档（chrome.storage.local）                                 │
│ - 截图剥离（base64 → 占位符）以控制配额                    │
│ - 最多 100 条会话，最旧淘汰                                 │
│ - 元数据：id, title（从首条用户消息推导）, 时间             │
└─────────────────────────────────────────────────────────────┘
```

#### 10. i18n（`shared/i18n.ts` + `shared/i18nReact.tsx`）

**设计约束：**
- 无外部依赖（不用 i18next）
- 必须在 Service Worker（无 DOM）、React 组件和设置页中都能工作
- 按区域拆分字典，多人编辑时避免合并冲突

**架构：**
- `translate(lang, key, params)` — 核心函数，到处可用
- `makeT(lang)` — 柯里化辅助，给后台脚本用
- `I18nProvider` + `useT()` — React context + hook
- `resolveLang(setting)` — 将 'auto' 解析为 'zh'|'en'
- Manifest 使用 Chrome 内置 `_locales/` 做商店列表本地化

#### 11. 消息协议

侧边栏与后台通过长连接 `chrome.runtime.Port` 通信：

**面板 → 后台（`PanelToBg`）：**
`hello` / `send` / `continue` / `abort` / `set_model` / `approval` / `switch_conv` / `delete_conv` / `new_chat` / `detach` / `open_options`

**后台 → 面板（`BgToPanel`）：**
`snapshot`（连接时全量同步）/ `item_upsert` / `text_delta` / `run_state` / `conversations` / `models` / `usage`

### 构建系统

```bash
node build.mjs [--watch]
```

单个 esbuild 脚本产出：
- `dist/background.js` — Service Worker 包（ESM，单文件）
- `dist/sidepanel.js` + `dist/sidepanel.html` — 侧边栏 React 应用
- `dist/options.js` + `dist/options.html` — 设置页 React 应用
- `dist/public/` — 静态资源（图标、CSS、manifest）

无 webpack，无 Vite — 纯 esbuild，亚秒构建。
