# Testing Protocol / 验证协议

[English](#english) | [中文](#中文)

---

## English

### Automated Tests

```bash
npm test              # typecheck + unit + e2e
npm run test:unit     # logic unit tests (node:test, millisecond-fast)
npm run test:e2e      # real Chromium perception tests (Playwright)
npm run bench         # perception benchmark (5 fixtures, ground-truth scoring)
npm run bench:e2e     # end-to-end agent eval (real LLM + Playwright)
```

**Unit tests** (`test/unit/`): adapter streaming, tool chunk accumulation, history format conversion, set-of-marks geometry, `wait_for` conditions, site permission matching, config merging, context governance (token estimation, budget trimming, pair integrity, result compression, cost calculation), retry & error classification, session export, session archive — 75 tests, pure Node.

**E2E** (`test/e2e/`): Playwright injects `pageAgent` into real Chromium pages with Shadow DOM, same-origin iframes, forms, and off-viewport elements. Tests Shadow DOM piercing, iframe coordinate conversion, `form_input` event triggering, `probe`, and `extract_data` (tables/links/selector extraction piercing shadow & iframe) — 11 tests.

**Perception benchmark** (`eval/perception.bench.mjs`): Diverse frontend structure fixtures (e-commerce cards, data tables, shadow+iframe mix, dynamic loading, complex positioning) + ground-truth. Quantifies `read_page` / `find` / `extract_data` / `wait_for` reliability. Non-zero exit on failure (CI-friendly). Baseline: **5/5**.

**Agent E2E eval** (`eval/agent-e2e.bench.mjs`): WebVoyager-inspired reproducible local version — real LLM decisions + Playwright browser + local fixture sites + automatic judgment. Tasks: click-to-cart, structured data QA, form submission, multi-step navigation. Requires `EVAL_BASE_URL` / `EVAL_API_KEY` / `EVAL_MODEL` env vars. Tested with gpt-5.4-mini and gpt-5.6-terra: **4/4**.

### Manual Verification Protocol

The automated tests cover perception and logic. The following protocol covers **full extension behavior** that requires loading the extension into Chrome: CDP trusted input, sidebar UI, complete agent loop, per-site authorization, etc.

**Total time: ~5–10 minutes.**

#### 0. Load the Extension

```bash
npm install && npm run build
```

`chrome://extensions` → Developer mode → Load unpacked → select `dist` → fill the Base URL (usually ending in `/v1`) and API key in Options → Test Connection → open sidebar, pick a visual model (e.g., GPT-5.6 Terra).

> Debug: click the "Service Worker" link on the extension card to open the background console.

#### 0.5 One-click Diagnostics (fastest first check, no API cost)

Open any web page, then go to **Options → Diagnostics** tab, click "Diagnose current tab". It checks: CDP attach, screenshot, element collection (top/shadow/iframe distribution), frame structure, network state.

- All green = perception + CDP pipeline works on this page.
- To verify Shadow DOM piercing specifically: open youtube.com then diagnose.

#### 1. Smoke Test (basic flow + per-site auth)

> Prompt: **Open news.ycombinator.com, list the first 5 headlines with links**

Expected: authorization card for `news.ycombinator.com` → approve → new tab in "Agent" group → screenshot → structured report.

#### 2. Set-of-marks (numbered boxes + click-by-number)

> Prompt: **Open https://httpbin.org/forms/post, fill Customer name = John, select Pizza size = Large, check Bacon, then screenshot**

Expected: screenshot shows colored numbered boxes on interactive elements; `form_input` uses `ref=<number>` (not coordinates); form filled correctly.

#### 3. Shadow DOM Piercing

> Prompt: **Open youtube.com, use read_page to tell me the top 3 video titles**

Expected: `read_page` lists elements inside shadow roots with actual video titles/links.

#### 4. Network-idle + wait_for

> Prompt: **Open duckduckgo.com, search "browser automation", give me the first 3 result titles**

Expected: no premature screenshot during loading; results shown in completed state.

#### 5. Planner + Validator

> Prompt: **Look up on Wikipedia who proposed the "Turing machine", give me a one-sentence answer**

Expected: planning output with success criteria at task start; "✅ Validation passed" or "🔎 Validation failed → continuing" info item at end.

#### 6. Security Confirmation

> Prompt: **Type test123 into a password field** (on any page with a login form)

Expected: confirmation card before typing into password field. Denial stops the action.

---

## 中文

### 自动化测试

```bash
npm test              # typecheck + 单元 + E2E
npm run test:unit     # 纯逻辑单元测试（node:test，毫秒级）
npm run test:e2e      # 真实 Chromium 感知层测试（Playwright）
npm run bench         # 感知层基准评测（5 fixture，ground-truth 计分）
npm run bench:e2e     # 端到端 agent 评测（真实 LLM + Playwright）
```

**单元测试**（`test/unit/`）：适配器流式解析、工具分片累积、历史格式转换、set-of-marks 几何、`wait_for` 条件、站点权限匹配、配置合并、上下文治理（token 估算/预算裁剪/配对完整性/结果压缩/成本换算）、退避重试与错误分类、会话导出、会话归档存储 — 共 75 项，纯 Node。

**E2E**（`test/e2e/`）：用 Playwright 把 `pageAgent` 注入真实 Chromium 页面，在带 Shadow DOM、同源 iframe、表单、视口外元素的 fixture 上验证 — Shadow DOM 穿透、iframe 坐标换算、`form_input` 事件触发、`probe`，以及 `extract_data` 的表格/链接/selector 抽取 — 共 11 项。

**感知层基准**（`eval/perception.bench.mjs`）：多样真实前端结构 fixture + ground-truth，量化 `read_page`/`find`/`extract_data`/`wait_for` 可靠性。有失败时非零退出（CI 友好）。基线：**5/5**。

**端到端 agent 评测**（`eval/agent-e2e.bench.mjs`）：WebVoyager 精神的可复现本地版 — 真实 LLM 决策 + Playwright 浏览器 + 本地 fixture 站点 + 自动判定。需 `EVAL_BASE_URL`/`EVAL_API_KEY`/`EVAL_MODEL` 环境变量。已实测 gpt-5.4-mini 和 gpt-5.6-terra：**4/4**。

### 手动验证协议

自动化测试覆盖感知层和逻辑。以下协议覆盖**必须加载扩展**才能验证的全链路行为：CDP 可信输入、侧边栏、完整 agent 循环、逐站授权等。

**总时间：约 5–10 分钟。**

#### 0. 加载扩展

```bash
npm install && npm run build
```

`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `dist` → 设置页填写 Base URL（通常以 `/v1` 结尾）和 API Key → 测试连接 → 工具栏图标打开侧边栏，选视觉模型（如 GPT-5.6 Terra）。

#### 0.5 一键诊断（最快的第一步，不花 API 钱）

打开任意网页，设置页 → 诊断标签 → 点「诊断当前标签页」。体检：CDP 附加、截图、元素收集（含 shadow/iframe 分布）、帧结构、网络状态。

- 全绿 = 感知层 + CDP 全链路通了。
- 验证 Shadow DOM：打开 youtube.com 再诊断。

#### 1. 冒烟（基础链路 + 逐站授权）

> 提示词：**打开 news.ycombinator.com，把首页前 5 条标题和链接整理成列表给我**

预期：授权卡片 → 允许 → 新标签归入 Agent 标签组 → 截图 → 结构化汇报。

#### 2. Set-of-marks（编号框 + 按编号点击）

> 提示词：**打开 https://httpbin.org/forms/post，填写 Customer name = 张三、选 Pizza size = Large、勾选 Bacon，然后截图**

预期：截图有编号框；`form_input` 参数是 `ref=<数字>`；表单正确填充。

#### 3. Shadow DOM 穿透

> 提示词：**打开 youtube.com，用 read_page 告诉我首页最上面 3 个视频的标题**

预期：`read_page` 能列出 shadow root 内部的视频链接元素。

#### 4. Network-idle + wait_for

> 提示词：**打开 duckduckgo.com，搜索「browser automation」，等结果加载出来后把前 3 条结果标题给我**

预期：不会在 loading 中途截图；拿到的是加载完成后的结果。

#### 5. Planner + Validator

> 提示词：**在维基百科查一下「图灵机」是谁提出的，给我一句话答案**

预期：任务开始有计划输出（含成功判据）；结束前出现自检信息条。

#### 6. 安全确认

> 提示词：**在任意登录页的密码框里输入 test123**

预期：向密码框输入前弹确认卡片。拒绝后模型停手。

---

### Known Edge Cases / 已知注意事项

- Cross-origin iframe internals are a single clickable region (`get_page_text` can read text)
- Some rich-text editors relying on per-key `keydown` may not respond to `computer type` — use `form_input`
- YouTube/DuckDuckGo structure changes over time; if results look off, check `read_page` output first
