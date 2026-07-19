# Changelog / 更新日志

This project follows [Semantic Versioning](https://semver.org/).

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

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
