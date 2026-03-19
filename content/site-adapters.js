// site-adapters.js
// per-site DOM selectors and interaction strategies.
//
// contract per adapter:
//   inputSelector    – CSS selector for the main textarea / contenteditable
//   submitSelector   – CSS selector for the send button
//   responseSelector – CSS selector for assistant response containers
//   thinkingSelector – CSS selector for "still generating" indicator
//   useEnterToSubmit – simulate Enter key instead of clicking a button
//   waitBeforeSubmit – ms to wait after filling before submitting
//   fillInput(el, text) – (optional) custom input fill function
//   extractResponse()   – (optional) custom response extraction

// ---- shared fill helpers ----

function __askall_fillContentEditable(el, text) {
  el.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("insertText", false, text);
}

function __askall_fillReactTextarea(el, text) {
  el.focus();
  const proto = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// execCommand on textarea triggers real beforeinput + input events
// that React/Vue frameworks reliably capture
function __askall_fillViaExecCommand(el, text) {
  el.focus();
  el.select();
  document.execCommand("insertText", false, text);
}

// ---- adapters ----

window.__ASKALL_ADAPTERS = {

  "chatgpt.com": {
    inputSelector: "#prompt-textarea, [id='prompt-textarea'] p",
    submitSelector: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
    responseSelector: '[data-message-author-role="assistant"]',
    thinkingSelector: '[data-testid="stop-button"], button[aria-label="Stop streaming"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 500,
    fillInput(el, text) {
      const container = document.querySelector("#prompt-textarea");
      if (!container) { return; }
      const p = container.querySelector("p");
      if (p) {
        p.focus();
        __askall_fillContentEditable(p, text);
      }
      container.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },

  "www.perplexity.ai": {
    inputSelector: 'textarea',
    submitSelector: 'button[aria-label="Submit"], button[aria-label="Ask"], button[type="submit"], button[class*="submit"], button[class*="send"]',
    responseSelector: '[class*="prose"], [class*="markdown"], [class*="response-text"], [class*="answer"]',
    thinkingSelector: '[class*="loading"], [class*="animate-pulse"], [class*="skeleton"], [class*="searching"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 1000,
    fillInput(el, text) {
      __askall_fillReactTextarea(el, text);
    }
  },

  "gemini.google.com": {
    inputSelector: '.ql-editor[contenteditable="true"], rich-textarea [contenteditable="true"], .input-area-container textarea',
    submitSelector: 'button.send-button, button[aria-label="Send message"], .send-button-container button',
    responseSelector: 'message-content, .model-response-text, .response-container',
    thinkingSelector: '.loading-indicator, .thinking-indicator, model-response[is-streaming]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      __askall_fillContentEditable(el, text);
    }
  },

  "manus.im": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i]',
    responseSelector: '[class*="message"][class*="assistant"], [class*="response"]',
    thinkingSelector: '[class*="loading"], [class*="typing"], [class*="generating"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 500,
  },

  "www.genspark.ai": {
    inputSelector: 'textarea, input[type="text"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i]',
    responseSelector: '[class*="answer"], [class*="response"], [class*="message"]',
    thinkingSelector: '[class*="loading"], [class*="thinking"], [class*="generating"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 600,
  },

  "agent.minimax.io": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[class*="send"], [class*="submit"]',
    responseSelector: '[class*="assistant"], [class*="bot-message"], [class*="response"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="typing"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 500,
  },

  "chat.deepseek.com": {
    inputSelector: "textarea",
    submitSelector: '[class*="ds-icon-button"]:not([class*="hover-bg"]), div[role="button"][aria-disabled="false"]',
    responseSelector: ".ds-markdown--block, .ds-markdown, [class*='markdown']",
    thinkingSelector: 'div[class*="stop-button"], div[class*="stopBtn"], [class*="loading"], [class*="generating"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 500,
    fillInput(el, text) {
      __askall_fillViaExecCommand(el, text);
    }
  },

  "grok.com": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[aria-label*="send" i], button[type="submit"]',
    responseSelector: '[class*="message-bubble"], [class*="response"], [class*="assistant"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="typing"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 500,
  },

  "www.kimi.com": {
    inputSelector: '[contenteditable="true"][role="textbox"], [contenteditable="true"][class*="editor"], [contenteditable="true"]',
    submitSelector: '[class*="send"]:not([disabled]), [class*="sendBtn"], button[class*="send"]',
    responseSelector: '[class*="markdown"], [class*="message-content"], [class*="assistant"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 800,
    fillInput(el, text) {
      // kimi uses Lexical editor — execCommand is the only reliable method
      __askall_fillContentEditable(el, text);
    }
  },

  "www.qianwen.com": {
    inputSelector: "textarea, [contenteditable='true']",
    submitSelector: '[class*="operateBtn"], [class*="send-btn"], [class*="submit"]',
    responseSelector: '[class*="message--assistant"], [class*="markdown-body"], [class*="answer-content"], [class*="text-message"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"], [class*="pending"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "www.doubao.com": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: '#flow-end-msg-send, [data-testid="chat_input_send_button"], [class*="send-btn"], button[class*="send"]',
    responseSelector: '[class*="markdown"], [class*="message-content"], [class*="receive"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 500,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillViaExecCommand(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "chat.mistral.ai": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i], button[class*="send"]',
    responseSelector: '[class*="prose"], [class*="markdown"], [class*="assistant"], [class*="message-content"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="stop"], [class*="typing"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },
  "www.reddit.com": {
    inputSelector: 'textarea, [contenteditable="true"], input[type="text"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i], button[aria-label*="ask" i], button[class*="submit"]',
    responseSelector: '[class*="answer"], [class*="markdown"], [class*="response"], [class*="message"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="thinking"], [class*="spinner"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 800,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "claude.ai": {
    inputSelector: '[contenteditable="true"], textarea',
    submitSelector: 'button[aria-label*="Send" i], button[type="submit"], button[class*="send"]',
    responseSelector: '[class*="response"], [class*="markdown"], [class*="assistant"], [class*="message"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      __askall_fillContentEditable(el, text);
    }
  },

  "www.phind.com": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i], button[class*="send"], button[class*="search"]',
    responseSelector: '[class*="prose"], [class*="markdown"], [class*="answer"], [class*="response"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="searching"], [class*="typing"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 800,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "huggingface.co": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i], button[class*="send"]',
    responseSelector: '[class*="prose"], [class*="markdown"], [class*="assistant"], [class*="message"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="stop"], [class*="typing"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "poe.com": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[class*="send"], button[aria-label*="send" i], button[type="submit"]',
    responseSelector: '[class*="markdown"], [class*="Message_bot"], [class*="response"], [class*="assistant"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"], [class*="typing"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "yiyan.baidu.com": {
    inputSelector: 'textarea#chat-textarea, textarea, [contenteditable="true"][class*="edit"], [contenteditable="true"]',
    submitSelector: '[class*="send"], [class*="submit"], button[type="submit"]',
    responseSelector: '[class*="markdown"], [class*="message-content"], [class*="answer"], [class*="bot"], [class*="assistant"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"], [class*="typing"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 800,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillViaExecCommand(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "chatglm.cn": {
    inputSelector: "textarea",
    submitSelector: '[class*="send"], button[type="submit"], button[aria-label*="send" i]',
    responseSelector: '[class*="markdown"], [class*="message-content"], [class*="answer"], [class*="assistant"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"], [class*="typing"]',
    useEnterToSubmit: true,
    waitBeforeSubmit: 500,
    fillInput(el, text) {
      __askall_fillViaExecCommand(el, text);
    }
  },

  "yuanbao.tencent.com": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: '[class*="send"], button[type="submit"], button[aria-label*="send" i]',
    responseSelector: '[class*="markdown"], [class*="message-content"], [class*="answer"], [class*="assistant"]',
    thinkingSelector: '[class*="stop"], [class*="loading"], [class*="generating"], [class*="typing"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 600,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "www.meta.ai": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i], div[role="button"][aria-label*="send" i]',
    responseSelector: '[class*="markdown"], [class*="response"], [class*="assistant"], [class*="message-content"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="typing"], [class*="progress"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 800,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },

  "copilot.microsoft.com": {
    inputSelector: 'textarea, [contenteditable="true"]',
    submitSelector: 'button[type="submit"], button[aria-label*="send" i], button[aria-label*="submit" i], button[class*="send"]',
    responseSelector: '[class*="response"], [class*="markdown"], [class*="assistant"], [class*="message"]',
    thinkingSelector: '[class*="loading"], [class*="generating"], [class*="typing"], [class*="progress"]',
    useEnterToSubmit: false,
    waitBeforeSubmit: 800,
    fillInput(el, text) {
      if (el.tagName === "TEXTAREA") {
        __askall_fillReactTextarea(el, text);
      } else {
        __askall_fillContentEditable(el, text);
      }
    }
  },
};

// fallback for custom / unknown sites
window.__ASKALL_ADAPTERS["__fallback"] = {
  inputSelector: 'textarea, input[type="text"], [contenteditable="true"]',
  submitSelector: '[id*="send" i], [data-testid*="send" i], button[type="submit"], button[aria-label*="send" i], button[class*="send"], [class*="icon-button"], div[role="button"][aria-disabled="false"]',
  responseSelector: '[class*="markdown"], [class*="response"], [class*="assistant"], [class*="message"]',
  thinkingSelector: '[class*="loading"], [class*="generating"], [class*="typing"], [class*="stop"]',
  useEnterToSubmit: false,
  waitBeforeSubmit: 800,
  fillInput(el, text) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      __askall_fillReactTextarea(el, text);
    } else {
      __askall_fillContentEditable(el, text);
    }
  }
};
