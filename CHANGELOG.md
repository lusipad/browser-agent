# Changelog / 更新日志

This project follows [Semantic Versioning](https://semver.org/).

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## 0.4.1 — 2026-09-15

### Fixed / 修复

- **CDP 网络监听死锁与动作延迟** — 修复 HTTP 30x 重定向导致 `inFlight` 请求计数重复累加的问题；监听 `Page.frameNavigated` 并在主 Frame 页面跳转时自动重置计数器，消除每次操作后非必要的 6 秒超时等待。
- **标签页关闭内存清理** — 监听 `chrome.tabs.onRemoved` 自动释放截图像素映射缓存 `lastShot`，杜绝内存泄漏。
- **OpenAI 流式工具调用解析** — 修复第三方反代网关或特定大模型服务在每个 chunk 重复发送完整函数名称导致工具名被多倍拼接（如 `computercomputer...`）的 Bug。
- **`wait_for` 跨页跳转异常容错** — 为探测轮询增加单次异常保护，平滑容忍页面刷新或跳转瞬间的 `Frame removed` 状态，避免智能体任务意外中断。
- **侧边栏截图放大预览** — 移除被 Chromium 拦截的 `window.open(dataUrl)`，新增侧边栏内置全屏 Lightbox 模态预览器，支持快捷键关闭，并支持生成安全 HTML Blob URL 在新标签页中无损查看大图。

### Changed / 变更

- **存储配额扩展** — 在 `manifest.json` 声明 `unlimitedStorage` 权限，彻底避免多会话历史积累超过默认 10MB 配额导致的保存失败。
- **设置页数字输入体验优化** — 高级设置中的数值输入框采用解耦的本地状态管理，支持自由退格清空后重新输入，失焦时自动进行边界规整与合法性检验。

### Testing / 测试

- 96 个单元测试（新增流式工具名称去重测试）、11 个真实 Chromium Playwright E2E 测试、TypeScript 类型检查与生产构建全部通过。

---

## 0.4.0 — 2026-09-04

### Added / 新增

- **以服务商为中心的模型管理** — 将 Endpoint、模型本体与模型接入关系拆分；同一个模型现在可通过多个服务商或网关使用。
- **模型发现与批量管理** — 服务商页可调用 OpenAI 兼容的 `/models` 接口同步模型清单，预览新增、已配置与已下线项，并批量导入、启用、禁用或删除模型接入。
- **接入状态控制** — 每条模型接入可独立启用或禁用；默认接入被禁用时自动回退到首个可用接入。

### Changed / 变更

- **Base URL 兼容** — Endpoint 地址末尾可带或不带 `/v1`；仅遇到 404 时尝试备用路径，鉴权、限流和服务端错误不再被备用请求掩盖。
- **注册表职责收敛** — 远程注册表改为元数据建议源，只更新已有模型的名称、视觉能力、上下文窗口与参考价格，不再创建、删除或改绑本地接入。
- **精确成本统计** — 成本按每次请求实际使用的模型接入累计。
- **平滑迁移** — 自动迁移旧版配置与历史会话到新的 Provider / Model / Binding 数据结构。

### Testing / 测试

- 95 个单元测试、11 个 E2E 测试、TypeScript 类型检查与生产构建全部通过。
- Chrome 内部页面策略阻止了自动化工具接管扩展设置页，因此本版本未完成真实扩展 UI 自动化验收。

---

## 0.3.1 — 2026-09-02

### Added / 新增

- **会话级视觉开关** — 侧边栏模型选择旁新增「视觉：开/关」按钮，每次会话开始时可临时决定是否使用截图感知（跟随模型 / 强制开启 / 关闭，新对话时重置为跟随模型）。关闭后全程改用 `read_page` 文本感知，不再产生截图与图片 token 开销；强制开启则允许在未标记视觉能力的模型上试跑截图。

### Changed / 变更

- **单轮迭代上限放宽** — 「单轮最大迭代次数」默认值由 24 提升至 100，设置页可调范围仍为 1–100（新安装生效；已保存的设置不受影响）。

### Testing / 测试

- 88 个单元测试全部通过（新增 7 个会话级视觉覆盖用例），TypeScript 类型检查通过。

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
