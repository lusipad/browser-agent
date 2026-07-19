<p align="center">
  <img src="docs/screenshots/store-hero.png" width="640" alt="Browser Agent">
</p>

<h1 align="center">Browser Agent</h1>

<p align="center">
  AI-powered browser automation from your sidebar — works with any OpenAI-compatible endpoint.
  <br>
  <a href="README.zh-CN.md">中文文档</a> · <a href="https://github.com/lusipad/browser-agent/releases">Releases</a> · <a href="PRIVACY.md">Privacy Policy</a>
</p>

---

A Chrome extension (MV3) that lets you control your browser with natural language. Type a task in the sidebar, and the AI agent opens tabs, clicks, fills forms, reads pages, and reports back — all with your own model and API key.

<p align="center">
  <img src="docs/screenshots/sidepanel-en.png" width="260" alt="Sidebar">
  &nbsp;&nbsp;
  <img src="docs/screenshots/options-en.png" width="400" alt="Options page">
</p>

## Features

- **Any OpenAI-compatible model** — OpenAI / DeepSeek / OpenRouter / Ollama / vLLM / LM Studio…
- **Keys stay local** — stored in `chrome.storage.local`, never sent to any intermediary
- **Per-site authorization** — each domain requires explicit approval before any interaction
- **Set-of-marks** — numbered bounding boxes overlaid on screenshots for precise element targeting
- **Shadow DOM & iframe piercing** — perception layer reaches into open shadow roots and same-origin frames
- **Planner + Validator** — decomposes tasks into steps with success criteria, self-checks completion
- **Network-idle wait** — actions wait for page load + network quiescence before proceeding
- **Trusted CDP input** — mouse/keyboard events via `chrome.debugger` (not synthetic DOM events)
- **Real-time cost tracking** — per-model pricing, context usage bar, cumulative cost display
- **Multi-session history** — archive, switch, export (Markdown/JSON)
- **Bilingual UI** — Chinese & English, follows browser locale or manual override
- **Tab group transparency** — agent-operated tabs grouped under blue "🤖 Agent" group

## Quick Start

```bash
npm install
npm run build        # outputs to dist/
```

1. Open `chrome://extensions`, enable **Developer mode**
2. Click **Load unpacked**, select the `dist` directory
3. The Options page opens — enter your endpoint URL and API key, click **Test Connection**
4. Click the toolbar icon to open the **sidebar**, pick a model, start chatting

> Use `npm run watch` during development. Changes to `src/` are rebuilt automatically; changes to `public/` require a full `npm run build`.

## Security Model

| Layer | Mechanism |
|---|---|
| Site authorization | Per-domain approval card (allow once / always / deny) |
| Financial blocklist | Banks, payment, exchanges pre-blocked |
| Sensitive confirmations | Password input, JS execution, file upload require per-action approval |
| Anti prompt-injection | System prompt declares page content as untrusted data, never instructions |
| `javascript_tool` off by default | Must be explicitly enabled in Advanced settings |
| Visible indicators | Blue "🤖 Agent" tab group + Chrome debugger banner |
| Defense in depth | No `externally_connectable`, isolated world injection, sender validation |

## Architecture

```
src/
  shared/          Types, settings, system prompt, utilities (shared between contexts)
    context.ts       Context governance: token estimation, budget trimming, cost accounting
    i18n/            Lightweight runtime i18n with area-split dictionaries
  providers/       OpenAI-compatible adapter (SSE streaming + history format conversion)
  background/      Service Worker: agent loop, session, permissions, tabs
    cdp.ts           chrome.debugger session, screenshots, console/network buffers
    reader.ts        Self-contained DOM perception functions injected into pages
    tools/           Tool definitions & dispatch (with site auth gating, post-action screenshots)
    agent.ts         Model ↔ tool iteration loop, context governance, Planner/Validator
    session.ts       Per-window session, persisted to chrome.storage.session
    history.ts       Multi-session archive to chrome.storage.local
  sidepanel/       React sidebar: conversation timeline, approval cards, model picker
  options/         React options page: providers, models, security, sites, advanced
```

## Tools

| Tool | Description |
|---|---|
| `tabs_context` / `tabs_create` / `tabs_close` | List / create (grouped) / close tabs |
| `navigate` | Go to URL, back/forward/refresh, wait for load, return screenshot |
| `computer` | Screenshot, click, double-click, right-click, hover, type, key combo, scroll, drag (CDP) |
| `read_page` / `find` | Extract interactive elements (stable ref, role, coords) / locate by text |
| `extract_data` | Structured extraction: tables, links, or CSS selector+fields → JSON (pierces shadow/iframe) |
| `form_input` | Fill by ref: input/textarea, select, checkbox/radio, contenteditable |
| `wait_for` | Poll until element appears/disappears or text matches (cross-frame & shadow) |
| `get_page_text` | Full-text extraction (incl. iframes), supports pagination |
| `scroll_to_ref` / `resize_window` / `screenshot` | Scroll to element / resize viewport / manual screenshot |
| `file_upload` | Fetch file from URL and inject into file input or simulate drag-drop |
| `javascript_tool` | Execute JS in page context (requires confirmation) |
| `read_console_messages` / `read_network_requests` | Read console & network logs |
| `gif_creator` | Export conversation screenshots as GIF |

## Testing

```bash
npm test              # typecheck + unit + e2e
npm run test:unit     # logic unit tests (node:test)
npm run test:e2e      # real Chromium perception tests (Playwright)
npm run bench         # perception benchmark (5 fixtures, ground-truth scoring)
npm run bench:e2e     # end-to-end agent eval (real LLM + Playwright + local fixtures)
```

See [docs/testing.md](docs/testing.md) for the full manual verification protocol.

## Documentation

| Document | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Detailed architecture & design decisions |
| [docs/testing.md](docs/testing.md) | Manual testing protocol for full extension verification |
| [docs/store/](docs/store/) | Chrome Web Store submission materials |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [PRIVACY.md](PRIVACY.md) | Privacy policy |

## Known Limitations

- Cross-origin iframe internals are treated as a single clickable region (text is readable via `get_page_text`)
- Cannot automate `chrome://` or Web Store pages
- Will not bypass CAPTCHAs or anti-bot measures
- Some rich-text editors relying on per-key `keydown` may not respond to `computer type` — use `form_input` instead

## Credits

Inspired by: [browser-use](https://github.com/browser-use/browser-use) (DOM serialization + set-of-marks), [Nanobrowser](https://github.com/nanobrowser/nanobrowser) (multi-agent Planner/Navigator/Validator), [BrowserBee](https://github.com/parsaghaffari/browserbee) (in-extension CDP). No code forked — implementation written independently.

## License

MIT
