# AskAll — Ask Every AI at Once

[中文版](README_CN.md)

Send one question to ChatGPT, Gemini, Claude, DeepSeek, Grok and 17+ AI chatbots simultaneously. Compare all responses side by side.

> **Privacy First:** No server, no tracking, no analytics. Your questions go directly from your browser to each AI provider.

## Install

**Chrome Web Store** (recommended):

<!-- TODO: replace # with actual Chrome Web Store URL after first publish -->
[Install AskAll](#)

**Manual install (developer mode):**

1. Clone or download this repo
2. Open `chrome://extensions/` → enable **Developer mode**
3. Click **Load unpacked** → select the project folder
4. Log in to each AI site beforehand — AskAll does not handle login or authorization

## Usage

1. Type your question (or load from **History** / **Templates**)
2. Optionally select **Prompt Enhancement** strategies (Chain-of-Thought, Step-by-Step, Expert Role, Be Concise, Pros & Cons)
3. Check which AI providers to query
4. Click **Send to All** (or `Ctrl+Enter` / `Cmd+Enter`)
5. Compare responses: **Copy All**, **Copy Single**, **Export Markdown**, or **Debug** for errors

## Supported AI Providers (22+)

| Category | Providers |
|----------|-----------|
| **General — Freemium** | ChatGPT, Gemini, Claude, Grok, Copilot, Mistral |
| **General — Free** | DeepSeek, Kimi, Qwen, Doubao, Yuanbao, ChatGLM, Baidu Chat, Sogou AI, MiniMax, MiMo |
| **Specialized — Freemium** | Perplexity, Manus |
| **Specialized — Free** | NVIDIA Build (Nemotron, MiniMax-M2.5, Kimi-K2.5, GLM5), Genspark, Duck.ai, Reddit Answers |
| **Custom** | Add any AI chatbot URL (up to 10) |

## Features

- **Batch Send** — open AI sites in batched tabs, auto-fill and submit your question
- **Prompt Enhancement** — Chain-of-Thought, Step-by-Step, Expert Role, Be Concise, Pros & Cons
- **Auto-Polling** — detects when each AI finishes responding via DOM stability check
- **Query History** — saves your last 50 queries; one-click to reuse
- **Prompt Templates** — save and reuse frequently asked questions (up to 30)
- **Export** — copy all responses or download as structured Markdown report
- **Per-Site Retry** — retry any failed site without resending all
- **3 Themes** — Light (ink-on-paper), Lumen (warm dark glass), Carbon (industrial precision)
- **Debug Tools** — built-in diagnostics for troubleshooting
- **Custom Sites** — add any chat URL with automatic host permission request

## Architecture

```
ask_all_ai/
├── manifest.json                Manifest V3
├── background/
│   └── service-worker.js        Tab orchestration, batching, timing, retry
├── content/
│   ├── site-adapters.js         Per-site DOM selectors (22 sites + fallback)
│   └── content-script.js        Injection, polling, extraction, diagnostics
├── popup/
│   ├── popup.html               Main UI
│   ├── popup.css                3-theme styles
│   └── popup.js                 UI logic, history, templates, export
├── icons/                       Extension icons (16/48/128)
└── scripts/
    ├── package.sh               Build Chrome Web Store ZIP
    └── sync-manifest.js         Sync manifest from popup.js site list
```

### Data Flow

```
User → Popup (question + site selection)
  → Service Worker (opens tabs in batches of 10)
    → Content Script (fills input, submits, polls DOM for response)
      → Service Worker (aggregates responses + stats)
        → Popup (displays comparison cards, progress, stats)
          → Copy / Export / Retry
```

## Adding New Sites

1. Add adapter in `content/site-adapters.js`:

```js
"example.com": {
  inputSelector: 'textarea',
  submitSelector: 'button[type="submit"]',
  responseSelector: '[class*="response"]',
  thinkingSelector: '[class*="loading"]',
  useEnterToSubmit: false,
  waitBeforeSubmit: 500,
}
```

2. Add site to `popup/popup.js` → `SITE_GROUPS` array
3. Run `node scripts/sync-manifest.js` to update manifest.json automatically

## Known Limitations

- Each AI site must be logged in separately before use
- Site DOM structures change over time; adapters may need periodic updates
- Some sites employ anti-automation measures that may block injection
- The extension does not select AI models — pre-configure your preferred model on each site

## Build

```bash
bash scripts/package.sh
# Output: dist/askall-v{version}.zip
```

## License

[MIT](LICENSE)
