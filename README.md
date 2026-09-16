<p align="center">
  <img src="docs/screenshots/store-hero.png" width="720" alt="Browser Agent">
</p>

<h1 align="center">Browser Agent</h1>

<p align="center">
  <strong>Next-Generation Autonomous AI Browser Agent · Your Personal Digital Copilot</strong>
  <br>
  Goal-Driven · Visual ROI Selection · Teach-Me Learning · Native CDP Control · Self-Verification
  <br>
  <a href="README.zh-CN.md">中文文档</a> · <a href="https://github.com/lusipad/browser-agent/releases">Releases</a> · <a href="PRIVACY.md">Privacy Policy</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/browser-agent/ojkmgbmibnijmgiceoffgkioneohajak"><img src="https://img.shields.io/badge/Chrome%20Web%20Store-v0.6.0-blue?logo=googlechrome&logoColor=white" alt="Chrome Web Store"></a>
  <a href="https://github.com/lusipad/browser-agent/releases"><img src="https://img.shields.io/github/v/release/lusipad/browser-agent?color=success" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-orange" alt="Manifest V3">
  <img src="https://img.shields.io/badge/DeepSeek-Supported-blueviolet" alt="DeepSeek">
</p>

---

**Browser Agent** is a **next-generation autonomous browser agent** living directly inside your Chrome side panel. Far more than a simple scraping script or macro recorder, it is a complete cognitive intelligence system equipped with **perception, autonomous planning, multimodal visual grounding, demonstration-to-skill learning, trusted CDP execution, and self-correcting validation**. Give it an open-ended goal, and it navigates, reasons, and executes across complex modern web applications just like a human expert — delivering verifiable, end-to-end outcomes.

<p align="center">
  <img src="docs/screenshots/demo.gif" width="700" alt="Browser Agent Live Demo">
</p>

---

## 📸 Feature Showcase

<p align="center">
  <img src="docs/screenshots/region-selection.png" width="720" alt="Visual ROI Selection & Point-and-Shoot">
  <br>
  <em>🎯 Visual Region Selection & Point-and-Shoot: Drag or click to snap any element, 1:1 pixel-perfect crop, cuts token usage by 80%, eliminates long-page ambiguity</em>
</p>

<p align="center">
  <img src="docs/screenshots/teach-me.png" width="720" alt="Learning from Demonstration (Teach-Me)">
  <br>
  <em>🔴 Learning from Demonstration (Teach-Me): Manually operate in the browser; the agent silently captures events with zero-leak credential redaction, and an LLM generalizes it into a reusable SKILL</em>
</p>

<p align="center">
  <img src="docs/screenshots/cron-intervention.png" width="720" alt="Scheduled Skills & Captcha Intervention">
  <br>
  <em>⏰ Scheduled Skills & Human Intervention: Periodic or daily cron background execution; gracefully suspends on Captcha/Turnstile challenges with instant resume</em>
</p>

<p align="center">
  <img src="docs/screenshots/form-filling.png" width="720" alt="End-to-End Workflow & Form Automation">
  <br>
  <em>✍️ Complex Workflow Automation: Native CDP physical input piercing Shadow DOM and dynamic SPAs</em>
</p>

---

## 🚀 Agent Superpowers

Break free from rigid single-step commands. The agent navigates the web with human-like cognitive agency:

- 🎯 **Visual Region-of-Interest (ROI) Selection & Point-and-Shoot** — Click `🎯` in the Composer or press `Alt + S` to enter crosshair selection mode. Box-select any card, chart, or table (or snap-click an element). The agent crops the area 1:1 via `OffscreenCanvas` with **zero CDP debugger warning banners**, passes high-res visual context, and **cuts prompt token usage by 70%~80%** while eliminating target ambiguity.
- 🔴 **Learning from Demonstration (Teach-Me)** — Click "🔴 Record New Skill" and interact with any webpage naturally (clicks, typing, navigations, file uploads). The agent silently intercepts user actions with automatic password redaction (`******`). When finished, an LLM abstracts raw selectors into resilient high-level intents and auto-extracts variable parameters into reusable SKILL workflows.
- ⏰ **Scheduled Skills & Background Cron** — Automate recurring workflows. Configure saved skills to run periodically (every 15m, 1h, 6h, 24h) or daily at a specific time (e.g. 09:30). Powered by `chrome.alarms` with desktop system notifications upon completion and full status reporting in Settings.
- 🛡️ **Human-in-the-Loop Captcha Intervention** — Built-in sniffers automatically detect Geetest, puzzle sliders, graphic captchas, SMS OTPs, and Cloudflare Turnstile. Rather than failing or hallucinating, the agent cleanly suspends execution and alerts the user; once solved in the browser, clicking "I have completed verification" seamlessly resumes the workflow.
- ⚡ **Reusable SKILL Workflows & Zero-Leak Cloud Sync** — Crystallize completed runs into reusable SKILLs with variable extraction (`{{keyword}}`). Synchronize bindings and workflows in real time across machines via `chrome.storage.sync` while **strictly keeping API keys isolated in local storage (`chrome.storage.local`)**.
- 🧠 **Autonomous Planning & Self-Correction Loop** — Built on a Planner + Actor + Validator cognitive architecture with planning limits expanded up to **500 iterations**. Decomposes open-ended goals into structured steps and validates page state before declaring victory.
- 👁️ **Native System-Level Control & Spatial Grounding** — Driven by Chrome DevTools Protocol (CDP) for authentic, trusted mouse and keyboard events (bypassing synthetic DOM event filters). Paired with Set-of-Marks visual tags to effortlessly conquer SPAs, nested Shadow DOMs, and cross-origin iframes.
- 🔒 **Sovereign Local-First Architecture (Zero-Cloud)** — Liberate yourself from overpriced monthly subscriptions and cloud surveillance. Direct connection to DeepSeek, Claude, OpenAI, or 100% offline Ollama / vLLM. Zero intermediary servers, per-site authorization gating, and prompt-injection defenses.

---

## Features

- **🎯 Visual ROI Box-Selection** — drag-to-select or snap-click, 1:1 pixel-perfect crop, 80% token reduction, full-resolution Lightbox preview
- **🔴 Demonstration Learning (Teach-Me)** — silent event interception, password redaction, LLM generalization into standard SKILLs
- **⏰ Scheduled Skills (Cron)** — periodic or daily background execution, desktop notifications, status feedback in Settings
- **🛡️ Human Captcha Intervention** — automatic detection of sliders/captchas, non-blocking suspension, and one-click resume
- **Provider-centered model management** — connect OpenAI / DeepSeek / OpenRouter / Ollama / vLLM / LM Studio…, discover models from `/models`, and manage them in bulk
- **Multiple endpoints per model** — use the same model through different providers or gateways
- **Keys stay local** — stored in `chrome.storage.local`, never sent to any intermediary
- **Per-site authorization** — each domain requires explicit approval before any interaction
- **Set-of-marks** — numbered bounding boxes overlaid on screenshots for precise element targeting
- **Shadow DOM & iframe piercing** — perception layer reaches into open shadow roots and same-origin frames
- **Planner + Validator** — decomposes tasks into steps with success criteria, supports up to 500 planning iterations
- **Network-idle wait** — actions wait for page load + network quiescence before proceeding
- **Trusted CDP input** — mouse/keyboard events via `chrome.debugger` (not synthetic DOM events)
- **Real-time cost tracking** — per-model pricing, context usage bar, cumulative cost display
- **Multi-session history** — archive, switch, export (Markdown/JSON)
- **Bilingual UI** — Chinese & English, follows browser locale or manual override
- **Tab group transparency** — agent-operated tabs grouped under blue "🤖 Agent" group

---

## Quick Start

```bash
npm install
npm run build        # outputs to dist/
```

1. Open `chrome://extensions`, enable **Developer mode**
2. Click **Load unpacked**, select the `dist` directory
3. The Options page opens — enter your endpoint URL and API key, click **Test Connection**
4. Click the toolbar icon to open the **sidebar**, pick a model, start chatting

> Base URLs may be entered with or without a trailing `/v1` (for example, `https://provider.example` or `https://provider.example/v1`). **Test Connection** validates the endpoint, while **Sync Models** reads `/models` so you can import, enable, disable, or delete model access in bulk.
>
> Use `npm run watch` during development. Changes to `src/` are rebuilt automatically; changes to `public/` require a full `npm run build`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + S` | Enter in-page Visual Region Selection mode (🎯 Point-and-Shoot) |
| `Esc` | Cancel region selection / close Lightbox preview / dismiss drawers |
| `Enter` | Submit prompt (pressing Enter with an attached region defaults to analyze/extract) |
| `Shift + Enter` | Insert newline in Composer input |

---

## Security Model

| Layer | Mechanism |
|---|---|
| Site authorization | Per-domain approval card (allow once / always / deny) |
| Financial blocklist | Banks, payment, exchanges pre-blocked |
| Sensitive confirmations | Password input, JS execution, file upload require per-action approval |
| Demonstration privacy | Password inputs (`type="password"`) are redacted to `******` during recording |
| Credential physical isolation | API Keys reside exclusively on local storage; sanitized before cloud sync |
| Anti prompt-injection | System prompt declares page content as untrusted data, never instructions |
| `javascript_tool` off by default | Must be explicitly enabled in Advanced settings |
| Visible indicators | Blue "🤖 Agent" tab group + Chrome debugger banner |
| Defense in depth | No `externally_connectable`, isolated world injection, sender validation |

---

## Architecture

```
src/
  shared/          Types, settings, system prompt, utilities, i18n, skill storage & sync
    context.ts       Context governance: token estimation, budget trimming, cost accounting
    skill.ts         SKILL data structures, variable template resolution, import/export
    syncStorage.ts   Dual-layer sync engine with zero-leak local secret isolation
  providers/       OpenAI-compatible adapter (SSE streaming + history format conversion)
  background/      Service Worker: agent loop, session, permissions, tabs
    cdp.ts           chrome.debugger session, screenshots, console/network buffers
    reader.ts        Self-contained DOM perception functions (with anti-bot / captcha sniffing)
    regionSelector.ts In-page visual region selection injector (crosshair + element snap)
    recorder.ts      Demonstration recorder (debounced input, clicks, uploads, password redaction)
    scheduler.ts     chrome.alarms-based skill scheduler and desktop notification dispatch
    skillGen.ts      LLM trajectory crystallizer and demonstration action flow generalizer
    screenshot.ts    DPR-aware OffscreenCanvas high-resolution region cropping
    tools/           Tool definitions and dispatch (with human intervention & site gating)
    agent.ts         Model ↔ Tool iteration loop, multimodal prompt construction, Planner/Validator
    session.ts       Per-window session controller (suspension/resume, recording, persistence)
    history.ts       Multi-session archiving to chrome.storage.local
  sidepanel/       React side panel: conversation timeline, region chip, recording banner, lightbox
  options/         React settings page: providers, models, skill studio (cron config), sync, advanced
```

---

## Toolset

| Tool | Description |
|---|---|
| `tabs_context` / `tabs_create` / `tabs_close` | List / open (grouped under Agent tag) / close tabs |
| `navigate` | Navigate URL, back/forward/reload, wait for load and return screenshot |
| `computer` | Screenshot, click, double/right click, hover, type, key combos, scroll, drag (CDP) |
| `read_page` / `find` | Extract interactive elements (stable ref, role, coordinates) / search by text |
| `extract_data` | Structured extraction: tables/links/CSS selector+fields → JSON |
| `form_input` | Fill forms by ref: input/textarea, select, checkbox/radio, contenteditable |
| `wait_for` | Poll-wait for element appearance/disappearance/text match |
| `get_page_text` | Extract full page text (including iframes) with pagination |
| `scroll_to_ref` / `resize_window` / `screenshot` | Scroll to element / resize window / take screenshot |
| `file_upload` | Download file from URL and inject into file input or simulate drag-and-drop |
| `request_human_intervention` | Suspend execution and prompt human operator when facing captchas, sliders, or OTPs |
| `javascript_tool` | Execute JavaScript in page context (requires explicit confirmation) |
| `read_console_messages` / `read_network_requests` | Read console and network logs |
| `gif_creator` | Export conversation screenshot frames into an animated GIF |

---

## Testing

```bash
npm test              # Full test suite: typecheck + 131 unit tests + E2E
npm run test:unit     # Unit tests with node:test
npm run test:e2e      # Real Chromium perception tests via Playwright
node scripts/test-region-e2e.mjs    # Visual region selection E2E verification
node scripts/test-teach-me-e2e.mjs  # Teach-Me demonstration E2E verification
npm run bench         # Perception benchmark (5 fixtures, ground-truth scoring)
npm run bench:e2e     # End-to-end agent benchmark (real LLM + Playwright)
```

See [docs/testing.md](docs/testing.md) for full manual validation protocol.

---

## Documentation

| Document | Description |
|---|---|
| [docs/releases/v0.6.0.md](docs/releases/v0.6.0.md) | **v0.6.0 Major Release Notes & Changelog** |
| [docs/releases/v0.5.1.md](docs/releases/v0.5.1.md) | v0.5.1 SKILL Workflows & Cloud Sync Release Notes |
| [docs/architecture.md](docs/architecture.md) | In-depth architecture design and state machines |
| [docs/testing.md](docs/testing.md) | End-to-end manual and automated validation protocol |
| [docs/store/submission.md](docs/store/submission.md) | Chrome Web Store submission & permission checklist |
| [docs/PROMOTION_GUIDE.md](docs/PROMOTION_GUIDE.md) | Marketing and community launch playbook |
| [docs/VIDEO_STORYBOARD.md](docs/VIDEO_STORYBOARD.md) | Video storyboard and demonstration scripts |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [PRIVACY.md](PRIVACY.md) | Privacy policy |

---

## Known Limitations

- Cross-origin iframes are treated as single clickable areas (text can be read via `get_page_text`)
- Cannot automate internal `chrome://` and Web Store management pages
- Will not and should not bypass financial payment passwords; captchas are delegated via `request_human_intervention`
- Rich-text editors requiring key-by-key event triggers may prefer `form_input` over `computer type`

---

## Acknowledgements

Architectural insights inspired by: [browser-use](https://github.com/browser-use/browser-use) (DOM serialization + set-of-marks), [Nanobrowser](https://github.com/nanobrowser/nanobrowser) (multi-agent Planner/Navigator/Validator), [BrowserBee](https://github.com/parsaghaffari/browserbee) (in-extension CDP driver). Written independently from scratch.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lusipad/browser-agent&type=Date)](https://star-history.com/#lusipad/browser-agent&Date)

---

## License

MIT
