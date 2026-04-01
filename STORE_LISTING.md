# Chrome Web Store — Listing & Permission Justifications

Ready-to-paste text for the Chrome Web Store submission form.

---

## Store Name

AskAll — Ask Every AI at Once

## Short Description (132 chars max)

Send one question to ChatGPT, Gemini, Claude, DeepSeek, Grok and 17+ AI chatbots at once. Compare all responses side by side.

## Detailed Description

AskAll lets you send a single question to multiple AI chatbot websites simultaneously and compare their responses in one view.

**How it works:**
1. Type your question in AskAll
2. Select which AI providers to query (22+ supported)
3. Click "Send to All" — AskAll opens each AI site in a background tab, types your question, and collects the responses
4. Compare all responses side by side with word count, response time, and export options

**Supported AI Providers:**
• General (Freemium): ChatGPT, Gemini, Claude, Grok, Copilot, Mistral
• General (Free): DeepSeek, Kimi, Qwen, Doubao, Yuanbao, ChatGLM, Baidu Chat, Sogou AI, MiniMax, MiMo
• Specialized: Perplexity, Manus, NVIDIA Build, Genspark, Duck.ai, Reddit Answers
• Custom: Add any AI chatbot URL

**Features:**
• Prompt Enhancement: Chain-of-Thought, Step-by-Step, Expert Role, Be Concise, Pros & Cons
• Query History: Revisit and reuse past questions
• Templates: Save frequently used prompts
• Export: Copy all responses or download as Markdown report
• Debug Tools: Built-in diagnostics for troubleshooting
• Three UI themes: Light, Lumen, Carbon

**Privacy First:**
• No data is sent to any server controlled by AskAll
• No analytics, tracking, or telemetry
• All preferences stored locally in your browser
• Your questions go directly from your browser to each AI provider

**Important:** You must be logged in to each AI service before using AskAll. The extension automates typing and collecting responses — it does not bypass logins, paywalls, or usage limits.

## Category

Productivity

## Language

English

---

## Permission Justifications

Paste these into the "Justify permissions" section of the submission form.

### `tabs`

**Justification:** AskAll creates new browser tabs for each AI chatbot website the user selects, monitors their loading status, switches between them during the warm-up phase, and closes them when the user clicks Reset. The tabs permission is required to call chrome.tabs.create, chrome.tabs.update, chrome.tabs.remove, and chrome.tabs.query. Without this permission, the core functionality of opening multiple AI sites simultaneously would not be possible.

### `scripting`

**Justification:** AskAll uses chrome.scripting.executeScript to inject content scripts into AI chatbot pages. The content scripts fill in the user's question into each site's input field, submit it, and observe the DOM for the AI's response. This is the core mechanism by which AskAll collects responses from multiple AI providers. The scripts are only injected into the specific AI chatbot sites listed in host_permissions.

### `storage`

**Justification:** AskAll uses chrome.storage.local to persist user preferences locally in the browser: selected AI providers, UI theme choice, prompt enhancement selections, query history (last 50 questions), saved prompt templates (max 30), and custom site URLs. No data is synced to any external server. Users can clear all stored data by uninstalling the extension or using the built-in Clear/Reset functions.

### Host permissions (22 AI chatbot sites)

**Justification:** Each host permission corresponds to a specific AI chatbot website that AskAll supports. The extension needs access to these sites to inject content scripts that:
1. Fill the user's question into the site's chat input field
2. Click the submit/send button
3. Observe the DOM to detect when the AI has finished generating its response
4. Extract the response text to display in the AskAll comparison view

The sites are: chatgpt.com, gemini.google.com, claude.ai, grok.com, copilot.microsoft.com, chat.mistral.ai, chat.deepseek.com, www.kimi.com, chat.qwen.ai, www.doubao.com, yuanbao.tencent.com, chatglm.cn, chat.baidu.com, www.sogou.com, agent.minimax.io, aistudio.xiaomimimo.com, www.perplexity.ai, manus.im, build.nvidia.com, www.genspark.ai, duck.ai, www.reddit.com.

Each site requires its own host permission because Chrome's content script injection model requires explicit URL pattern matching. No other websites are accessed.

---

## Store Assets Checklist

- [ ] Icon 128x128 PNG (already in icons/icon128.png)
- [ ] Screenshot 1: Main UI with question input and AI provider selection (1280x800)
- [ ] Screenshot 2: Responses comparison view with multiple AI responses (1280x800)
- [ ] Screenshot 3: Export and debug features (1280x800)
- [ ] Small promotional tile: 440x280 (optional)
- [ ] Large promotional tile: 1400x560 (optional, for featured placement)
- [ ] Privacy policy URL (host privacy-policy.html on GitHub Pages)

## Submission Notes

- Category: Productivity
- Visibility: Public
- Distribution: All regions
- Mature content: No
- Single purpose description: "Compare responses from multiple AI chatbots by sending one question to all of them simultaneously."
