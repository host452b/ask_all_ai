// content-script.js
// injected into AI chat pages. handles:
// 1. receiving a question from the background service worker
// 2. filling the input and submitting
// 3. observing DOM for response completion
// 4. reporting the extracted response back

(function () {
  "use strict";

  // prevent duplicate registration when re-injected
  if (window.__ASKALL_CONTENT_LOADED) {
    return;
  }
  window.__ASKALL_CONTENT_LOADED = true;

  const hostname = window.location.hostname;
  const adapters = window.__ASKALL_ADAPTERS || {};
  const adapter = adapters[hostname] || adapters["__fallback"];

  if (!adapter) {
    return;
  }

  let pollingTimer = null;
  let stabilityCounter = 0;
  let lastResponseText = "";
  const STABILITY_THRESHOLD = 3;
  const POLL_INTERVAL_MS = 2000;
  const MAX_POLL_DURATION_MS = 120000;

  // ============================================================
  //  HELPERS
  // ============================================================

  function queryFirst(selectorString) {
    if (!selectorString) {
      return null;
    }
    const selectors = selectorString.split(",").map((s) => s.trim());
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          return el;
        }
      } catch (_) {
        // invalid selector
      }
    }
    return null;
  }

  function queryAll(selectorString) {
    if (!selectorString) {
      return [];
    }
    const selectors = selectorString.split(",").map((s) => s.trim());
    const results = [];
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => results.push(el));
      } catch (_) {
        // skip
      }
    }
    return results;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ============================================================
  //  UNIVERSAL SUBMIT HELPERS
  // ============================================================

  const STEP_DELAY_MS = 300;

  function dispatchEnter(el) {
    const shared = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    };
    el.dispatchEvent(new KeyboardEvent("keydown", shared));
    el.dispatchEvent(new KeyboardEvent("keypress", shared));
    el.dispatchEvent(new KeyboardEvent("keyup", shared));
  }

  const SEND_KEYWORDS = /send|submit|ask|发送|提交/i;
  const SKIP_KEYWORDS = /attach|upload|menu|setting|config|voice|mic|image|photo|file|model/i;

  function isElementVisible(el) {
    if (!el) { return false; }
    try {
      const s = window.getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0" && el.offsetParent !== null;
    } catch (_) { return false; }
  }

  function isElementDisabled(el) {
    return el.disabled ||
      el.getAttribute("aria-disabled") === "true" ||
      el.getAttribute("data-disabled") === "true" ||
      el.classList.contains("disabled");
  }

  function scoreSubmitCandidate(el) {
    let score = 0;
    const tag = el.tagName;
    const text = (el.textContent || "").trim().toLowerCase();
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const testId = (el.getAttribute("data-testid") || "").toLowerCase();
    const cls = el.className || "";

    if (!isElementVisible(el)) { return -100; }
    if (isElementDisabled(el)) { return -50; }

    // positive: send-related signals
    if (SEND_KEYWORDS.test(label)) { score += 10; }
    if (SEND_KEYWORDS.test(id)) { score += 10; }
    if (SEND_KEYWORDS.test(testId)) { score += 10; }
    if (SEND_KEYWORDS.test(text) && text.length < 20) { score += 6; }
    if (el.querySelector("svg")) { score += 4; }
    if (tag === "BUTTON") { score += 2; }
    if (el.getAttribute("role") === "button") { score += 2; }
    if (el.getAttribute("type") === "submit") { score += 8; }

    // negative: unrelated buttons
    if (SKIP_KEYWORDS.test(label)) { score -= 15; }
    if (SKIP_KEYWORDS.test(id)) { score -= 15; }
    if (SKIP_KEYWORDS.test(cls)) { score -= 10; }
    if (SKIP_KEYWORDS.test(text) && !SEND_KEYWORDS.test(text)) { score -= 10; }

    return score;
  }

  function findNearbySubmitButton(inputEl) {
    let container = inputEl.parentElement;
    const MAX_CLIMB = 6;

    for (let level = 0; level < MAX_CLIMB && container; level++) {
      const candidates = container.querySelectorAll(
        'button, [role="button"], [class*="button"], [class*="btn"], [data-testid*="send"]'
      );

      let best = null;
      let bestScore = 0;

      for (const el of candidates) {
        if (el === inputEl || el.contains(inputEl)) { continue; }
        const s = scoreSubmitCandidate(el);
        if (s > bestScore) {
          bestScore = s;
          best = el;
        }
      }

      if (best && bestScore >= 4) {
        return best;
      }

      container = container.parentElement;
    }

    return null;
  }

  function tryFormSubmit(inputEl) {
    const form = inputEl.closest("form");
    if (!form) { return false; }
    try {
      if (form.requestSubmit) {
        form.requestSubmit();
      } else {
        form.submit();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // ============================================================
  //  FILL & SUBMIT
  // ============================================================

  async function fillAndSubmit(question) {
    try {
      const inputEl = queryFirst(adapter.inputSelector);
      if (!inputEl) {
        return { success: false, error: "input element not found" };
      }

      // step 1: focus
      inputEl.focus();
      await sleep(STEP_DELAY_MS);

      // step 2: fill
      if (adapter.fillInput) {
        adapter.fillInput(inputEl, question);
      } else if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
        setNativeValue(inputEl, question);
      } else {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(inputEl);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("insertText", false, question);
      }

      // step 3: wait for framework to process input
      await sleep(adapter.waitBeforeSubmit || 500);

      // step 4: submit
      if (adapter.useEnterToSubmit) {
        // direct Enter — skip all button-finding for Enter-to-send sites
        dispatchEnter(inputEl);
      } else {
        // four-level fallback for button-click sites
        let submitted = false;

        // level 1: adapter's specific selector (with retry for disabled state)
        for (let attempt = 0; attempt < 3 && !submitted; attempt++) {
          const btn = queryFirst(adapter.submitSelector);
          if (btn && !isElementDisabled(btn) && isElementVisible(btn)) {
            btn.click();
            submitted = true;
          }
          if (!submitted) { await sleep(STEP_DELAY_MS); }
        }

        // level 2: universal proximity search
        if (!submitted) {
          const nearby = findNearbySubmitButton(inputEl);
          if (nearby) {
            nearby.click();
            submitted = true;
          }
        }

        // level 3: form submit
        if (!submitted) {
          submitted = tryFormSubmit(inputEl);
        }

        // level 4: fallback Enter key
        if (!submitted) {
          dispatchEnter(inputEl);
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || "fill/submit failed" };
    }
  }

  // ============================================================
  //  RESPONSE DETECTION
  // ============================================================

  function isStillThinking() {
    if (!adapter.thinkingSelector) {
      return false;
    }
    const el = queryFirst(adapter.thinkingSelector);
    if (!el) {
      return false;
    }
    try {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    } catch (_) {
      return false;
    }
  }

  function extractLatestResponse() {
    try {
      if (adapter.extractResponse) {
        return adapter.extractResponse();
      }

      const elements = queryAll(adapter.responseSelector);
      if (elements.length === 0) {
        return "";
      }

      const lastEl = elements[elements.length - 1];
      return (lastEl.innerText || lastEl.textContent || "").trim();
    } catch (_) {
      return "";
    }
  }

  // ============================================================
  //  POLLING
  // ============================================================

  function startPolling() {
    stopPolling();
    stabilityCounter = 0;
    lastResponseText = "";
    let lastSentText = "";
    const startTime = Date.now();

    pollingTimer = setInterval(() => {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        stopPolling();
        sendStatus("timeout", extractLatestResponse());
        return;
      }

      const thinking = isStillThinking();
      const currentText = extractLatestResponse();

      if (!thinking && currentText && currentText === lastResponseText) {
        stabilityCounter++;
      } else {
        stabilityCounter = 0;
      }

      lastResponseText = currentText;

      // only send full text when it actually changed
      const textChanged = currentText !== lastSentText;
      if (textChanged) {
        sendStatus("polling", currentText);
        lastSentText = currentText;
      }

      if (!thinking && stabilityCounter >= STABILITY_THRESHOLD && currentText.length > 0) {
        stopPolling();
        sendStatus("done", currentText);
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function sendStatus(status, responseText) {
    try {
      chrome.runtime.sendMessage({
        type: "ASKALL_STATUS",
        hostname: hostname,
        status: status,
        response: responseText || "",
      });
    } catch (_) {
      // extension context invalidated (reloaded/uninstalled)
      stopPolling();
    }
  }

  // ============================================================
  //  DIAGNOSTICS
  // ============================================================

  function collectDiagnostics() {
    try {
      const inputEl = queryFirst(adapter.inputSelector);
      const submitEl = queryFirst(adapter.submitSelector);
      const responseEls = queryAll(adapter.responseSelector);
      const thinkingEl = queryFirst(adapter.thinkingSelector);

      // try to capture visible error/alert text on the page
      const errorHints = [];
      const errorSelectors = [
        '[class*="error"]', '[class*="alert"]', '[class*="warning"]',
        '[role="alert"]', '[class*="notice"]', '[class*="fail"]',
      ];
      for (const sel of errorSelectors) {
        try {
          document.querySelectorAll(sel).forEach((el) => {
            const text = (el.innerText || "").trim();
            if (text && text.length > 0 && text.length < 500) {
              errorHints.push(text);
            }
          });
        } catch (_) { /* skip */ }
      }

      return {
        hostname: hostname,
        pageTitle: document.title,
        currentUrl: window.location.href,
        adapterUsed: hostname in adapters ? hostname : "__fallback",
        selectors: {
          input: adapter.inputSelector,
          submit: adapter.submitSelector,
          response: adapter.responseSelector,
          thinking: adapter.thinkingSelector,
        },
        domProbe: {
          inputFound: !!inputEl,
          inputTag: inputEl ? inputEl.tagName : null,
          submitFound: !!submitEl,
          submitTag: submitEl ? submitEl.tagName : null,
          responseCount: responseEls.length,
          thinkingVisible: !!thinkingEl && isStillThinking(),
        },
        lastResponseLength: lastResponseText.length,
        stabilityCounter: stabilityCounter,
        errorHints: errorHints.slice(0, 5),
      };
    } catch (err) {
      return { hostname: hostname, error: err.message };
    }
  }

  // ============================================================
  //  MESSAGE LISTENER
  // ============================================================

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "ASKALL_INJECT") {
      stopPolling();
      fillAndSubmit(msg.question).then((result) => {
        if (result.success) {
          setTimeout(() => startPolling(), 2000);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: result.error });
        }
      });
      return true;
    }

    if (msg.type === "ASKALL_COLLECT") {
      const text = extractLatestResponse();
      const thinking = isStillThinking();
      let status = "done";
      if (thinking) {
        status = "polling";
      } else if (!text) {
        status = "empty";
      }
      sendResponse({ status: status, response: text });
      return true;
    }

    if (msg.type === "ASKALL_STOP") {
      stopPolling();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "ASKALL_DEBUG") {
      const diag = collectDiagnostics();
      sendResponse(diag);
      return true;
    }

    return false;
  });
})();
