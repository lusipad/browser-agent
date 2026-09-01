# Changelog / 更新日志

This project follows [Semantic Versioning](https://semver.org/).

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## 0.3.0 — 2026-09-02

### Added / 新增

- **远程模型仓库热更新** — `registry/models.json` 成为独立于扩展发版的模型清单源：设置页一键「拉取最新模型」，预览变更、勾选导入并自动补全缺失的服务商配置，无需等待新版本。
- **LiteLLM 开源模型库同步** — 接入 LiteLLM 模型数据库自动同步定价、上下文窗口、视觉支持等元数据，覆盖 22 个服务商、109 个模型（含 Anthropic、xAI、Mistral、Together 等）。
- **服务商与模型扩充** — 新增 Google AI Studio、Groq、硅基流动 SiliconFlow，以及智谱 AI、阿里云百炼、月之暗面 Kimi、阶跃星辰、百川智能、MiniMax、讯飞星火等国内主流服务商。
- **每周自动同步 CI** — GitHub Actions 每周拉取 LiteLLM 最新数据，有变更时自动创建 PR；也可通过 `npm run sync-registry` 手动更新。
- **发布工作流** — 新增 `.github/workflows/release.yml`，支持一键创建 GitHub Release。

### Testing / 测试

- 80 个单元测试全部通过，TypeScript 类型检查通过，构建产物正常生成。

---

## 0.2.2 — 2026-07-19

### Fixed / 修复

- **兼容接口诊断** — 当 Base URL 缺少 `/v1`、接口返回网页而非 SSE，或服务端返回 JSON 错误时，直接展示可操作的原因，不再笼统误报“模型空响应”。
- **规划与自检提示** — 模型在规划或校验阶段未返回可解析内容时明确标出模型和失败阶段，避免反复显示“任务尚未达成”。
- **模型可用性检查** — “测试连接”现在校验 OpenAI `/models` 响应格式，并列出当前服务商未提供的已配置模型。
- **GPT-5.6 默认配置** — 移除不存在的裸 `gpt-5.6`，补充 `gpt-5.6-sol`，并将新安装的默认模型设为已验证可用的 `gpt-5.6-terra`。

### Changed / 变更

- **扩展名称精简** — 中英文显示名统一缩短为 `Browser Agent`，避免浏览器扩展页和地址栏标题过长。
- **文档整理** — 补充双语 README、架构与测试文档，并更新商店提交说明和英文截图。

---

## 0.2.1 — 2026-07-19

- **Store icon redesign** — replaced generic silhouette with a branded robot face (blue gradient + white head + indigo eyes + antenna/smile), consistent with promo materials; still rendered by the zero-dependency generator at 16/32/48/128px.
- **Submission materials** — added 440×280 promo tile; `docs/store/submission.md` updated with remote code declaration, distribution settings, content rating, homepage/support URLs.

---

## 0.2.0 — 2026-07-19

From "working skeleton" to "reference-grade, publishable". All changes covered by unit tests, E2E, benchmarks, and real-device verification.

### Added / 新增

- **Context governance** — per-request token budget trimming, strict `tool_use`/`tool_result` pairing, oversized result compression (no tiktoken dependency)
- **Cost accounting** — per-model pricing config, real-time cumulative cost display + context usage progress bar in sidebar
- **Resilience** — exponential backoff retry (5xx/429/network), error classification with localized messages, one-click "Continue" at iteration cap
- **Session history & export** — multi-session archive, sidebar drawer (switch/delete/new), Markdown/JSON export
- **`extract_data` tool** — structured extraction (tables/links/selector), pierces shadow DOM & same-origin iframes
- **Perception benchmark** (`npm run bench`) & **agent E2E eval** (`npm run bench:e2e`, real LLM-driven)
- **i18n** — bilingual UI (Chinese/English), follows browser locale or manual override, manifest `_locales`, all user-facing strings localized
- **Tab group transparency** — agent-operated tabs grouped under blue "🤖 Agent", ungrouped on detach
- **Publishing materials** — privacy policy, store listing, submission guide

### Security / 安全

- System prompt anti prompt-injection section (page content = data, not instructions)
- Diagnostics message sender validation; `javascript_tool` off by default

### Testing / 测试

- 71 unit tests, 11 E2E, perception benchmark 5/5, agent eval 4/4 — all passing
- Playwright extension load verification: zero-error service worker startup, bilingual rendering confirmed

---

## 0.1.0

Initial release: MV3 extension, sidebar natural-language browser automation, OpenAI-compatible endpoints, CDP trusted input + screenshots, set-of-marks, Shadow/iframe piercing, Planner + Validator, per-site authorization, diagnostics panel, automated tests.
