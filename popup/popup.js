// popup.js
// UI logic, messaging, history, templates, export, retry, stats.

(function () {
  "use strict";

  // ============================================================
  //  CONSTANTS
  // ============================================================

  // sorted by 2026 popularity within each group
  const SITE_GROUPS = [
    {
      label: "General — Freemium",
      sites: [
        { name: "ChatGPT", url: "https://chatgpt.com/", hostname: "chatgpt.com" },
        { name: "Gemini", url: "https://gemini.google.com/", hostname: "gemini.google.com" },
        { name: "Claude", url: "https://claude.ai/", hostname: "claude.ai" },
        { name: "Grok", url: "https://grok.com/", hostname: "grok.com" },
        { name: "Copilot", url: "https://copilot.microsoft.com/", hostname: "copilot.microsoft.com" },
        { name: "Mistral", url: "https://chat.mistral.ai/", hostname: "chat.mistral.ai" },
        { name: "Poe", url: "https://poe.com/", hostname: "poe.com" },
      ]
    },
    {
      label: "General — Free",
      sites: [
        { name: "DeepSeek", url: "https://chat.deepseek.com/", hostname: "chat.deepseek.com" },
        { name: "Meta AI", url: "https://www.meta.ai/", hostname: "www.meta.ai" },
        { name: "Kimi", url: "https://www.kimi.com/", hostname: "www.kimi.com" },
        { name: "Qwen", url: "https://www.qianwen.com/", hostname: "www.qianwen.com" },
        { name: "Doubao", url: "https://www.doubao.com/chat/", hostname: "www.doubao.com" },
        { name: "Yuanbao", url: "https://yuanbao.tencent.com/", hostname: "yuanbao.tencent.com" },
        { name: "ChatGLM", url: "https://chatglm.cn/", hostname: "chatglm.cn" },
        { name: "Yiyan", url: "https://yiyan.baidu.com/", hostname: "yiyan.baidu.com" },
        { name: "MiniMax", url: "https://agent.minimax.io/", hostname: "agent.minimax.io" },
        { name: "HuggingChat", url: "https://huggingface.co/chat/", hostname: "huggingface.co" },
      ]
    },
    {
      label: "Specialized — Freemium",
      sites: [
        { name: "Perplexity", url: "https://www.perplexity.ai/", hostname: "www.perplexity.ai" },
        { name: "Manus", url: "https://manus.im/", hostname: "manus.im" },
      ]
    },
    {
      label: "Specialized — Free",
      sites: [
        { name: "Phind", url: "https://www.phind.com/", hostname: "www.phind.com" },
        { name: "Genspark", url: "https://www.genspark.ai/", hostname: "www.genspark.ai" },
        { name: "Reddit", url: "https://www.reddit.com/answers/", hostname: "www.reddit.com" },
      ]
    },
  ];

  // flat list for lookups
  const DEFAULT_SITES = SITE_GROUPS.flatMap((g) => g.sites);

  const STRATEGY_MAP = {
    cot: "Let's think step by step.\n\n",
    step: "Please break this down into numbered steps:\n\n",
    expert: "You are a world-class expert in this field. ",
    concise: "Be concise and direct. ",
    compare: "Analyze the pros and cons:\n\n",
  };

  const MAX_CUSTOM_SITES = 10;
  const STORAGE_KEY_SITES = "askall_selected_sites";
  const STORAGE_KEY_TEMPLATES = "askall_templates";
  const STORAGE_KEY_STRATEGIES = "askall_strategies";
  const STORAGE_KEY_CUSTOM_SITES = "askall_custom_sites";

  // ============================================================
  //  DOM REFS
  // ============================================================

  const questionEl = document.getElementById("question");
  const customSitesEl = document.getElementById("custom-sites");
  const siteListEl = document.getElementById("site-list");
  const toggleAllBtn = document.getElementById("toggle-all-btn");
  const sendBtn = document.getElementById("send-btn");
  const collectBtn = document.getElementById("collect-btn");
  const resetBtn = document.getElementById("reset-btn");
  const statusBar = document.getElementById("status-bar");
  const statusLabel = document.getElementById("status-label");
  const progressFill = document.getElementById("progress-fill");
  const responsesSection = document.getElementById("responses-section");
  const responsesContainer = document.getElementById("responses-container");
  const copyAllBtn = document.getElementById("copy-all-btn");
  const exportMdBtn = document.getElementById("export-md-btn");
  const copyDebugBtn = document.getElementById("copy-debug-btn");
  const toastEl = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");
  const historyBtn = document.getElementById("history-btn");
  const historyPanel = document.getElementById("history-panel");
  const tplSaveBtn = document.getElementById("tpl-save-btn");
  const tplLoadBtn = document.getElementById("tpl-load-btn");
  const tplPanel = document.getElementById("tpl-panel");

  let pollIntervalId = null;
  let allSelected = true;
  let prevDoneSet = new Set();
  let sendInFlight = false;
  let lastSentQuestion = "";

  // ============================================================
  //  SAFE MESSAGING
  // ============================================================

  function sendMsg(msg, callback) {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("[AskAll]", chrome.runtime.lastError.message);
          if (callback) { callback(null); }
          return;
        }
        if (callback) { callback(resp); }
      });
    } catch (_) {
      if (callback) { callback(null); }
    }
  }

  function storageGet(key, cb) {
    try {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) { cb(null); return; }
        cb(result);
      });
    } catch (_) { cb(null); }
  }

  function storageSet(data) {
    try { chrome.storage.local.set(data); } catch (_) { /* skip */ }
  }

  // ============================================================
  //  RESTORE ALL SETTINGS (single storage read)
  // ============================================================

  const themeBtns = document.querySelectorAll(".theme-btn");
  const sizeBtns = document.querySelectorAll(".size-btn");

  function applyTheme(name) {
    document.body.setAttribute("data-theme", name);
    themeBtns.forEach((b) => b.classList.toggle("active", b.dataset.theme === name));
  }

  function applySize(size) {
    document.body.setAttribute("data-size", size);
    sizeBtns.forEach((b) => b.classList.toggle("active", b.dataset.size === size));
  }

  function saveStrategies() {
    const checked = [];
    document.querySelectorAll(".strategy-cb").forEach((cb) => {
      if (cb.checked) { checked.push(cb.value); }
    });
    storageSet({ [STORAGE_KEY_STRATEGIES]: checked });
  }

  // one IPC call instead of five
  storageGet([
    "askall_theme",
    "askall_size",
    STORAGE_KEY_SITES,
    STORAGE_KEY_STRATEGIES,
    STORAGE_KEY_CUSTOM_SITES,
  ], (r) => {
    if (!r) { r = {}; }

    applyTheme(r.askall_theme || "lumen");
    applySize(r.askall_size || "m");

    renderSiteList(r[STORAGE_KEY_SITES] || null);
    if (r[STORAGE_KEY_SITES]) {
      allSelected = r[STORAGE_KEY_SITES].length === DEFAULT_SITES.length;
    }

    if (r[STORAGE_KEY_STRATEGIES] && Array.isArray(r[STORAGE_KEY_STRATEGIES])) {
      document.querySelectorAll(".strategy-cb").forEach((cb) => {
        cb.checked = r[STORAGE_KEY_STRATEGIES].includes(cb.value);
      });
    }

    if (r[STORAGE_KEY_CUSTOM_SITES]) {
      customSitesEl.value = r[STORAGE_KEY_CUSTOM_SITES];
    }
  });

  // save handlers
  themeBtns.forEach((b) => b.addEventListener("click", () => {
    applyTheme(b.dataset.theme);
    storageSet({ askall_theme: b.dataset.theme });
  }));

  sizeBtns.forEach((b) => b.addEventListener("click", () => {
    applySize(b.dataset.size);
    storageSet({ askall_size: b.dataset.size });
  }));

  document.querySelectorAll(".strategy-cb").forEach((cb) => {
    cb.addEventListener("change", saveStrategies);
  });

  customSitesEl.addEventListener("input", () => {
    storageSet({ [STORAGE_KEY_CUSTOM_SITES]: customSitesEl.value });
  });

  // ============================================================
  //  MICRO-INTERACTIONS
  // ============================================================

  function addRipple(btn, e) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
    ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  document.querySelectorAll(".btn").forEach((b) => {
    b.addEventListener("click", (e) => addRipple(b, e));
  });

  questionEl.addEventListener("input", () => {
    questionEl.style.height = "auto";
    questionEl.style.height = Math.min(questionEl.scrollHeight, 120) + "px";
  });

  questionEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  });

  function shakeElement(el) {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "card-arrive 400ms var(--ease-spring)";
  }

  // ============================================================
  //  SITE LIST + PERSISTENCE
  // ============================================================

  function renderSiteList(savedSelections) {
    siteListEl.innerHTML = "";
    let globalIdx = 0;

    SITE_GROUPS.forEach((group) => {
      const header = document.createElement("div");
      header.className = "site-group-header";
      header.textContent = group.label;
      siteListEl.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "site-list";
      siteListEl.appendChild(grid);

      group.sites.forEach((site) => {
        const isChecked = savedSelections
          ? savedSelections.includes(site.hostname)
          : true;

        const div = document.createElement("div");
        div.className = "site-item" + (isChecked ? " selected" : "");
        div.dataset.url = site.url;
        div.dataset.hostname = site.hostname;
        div.dataset.name = site.name;

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isChecked;
        cb.id = `site-cb-${globalIdx++}`;

        const favicon = document.createElement("img");
        favicon.className = "site-favicon";
        favicon.loading = "lazy";
        favicon.dataset.lazySrc = `https://www.google.com/s2/favicons?domain=${site.hostname}&sz=32`;
        favicon.alt = "";
        favicon.onerror = function () { this.style.display = "none"; };

        const nameSpan = document.createElement("span");
        nameSpan.className = "site-name";
        nameSpan.textContent = site.name;

        div.appendChild(cb);
        div.appendChild(favicon);
        div.appendChild(nameSpan);

        div.addEventListener("click", (e) => {
          if (e.target === cb) { return; }
          cb.checked = !cb.checked;
          div.classList.toggle("selected", cb.checked);
          saveSiteSelection();
        });

        cb.addEventListener("change", () => {
          div.classList.toggle("selected", cb.checked);
          saveSiteSelection();
        });

        grid.appendChild(div);
      });
    });
  }

  function saveSiteSelection() {
    const selected = [];
    siteListEl.querySelectorAll(".site-item").forEach((item) => {
      const cb = item.querySelector('input[type="checkbox"]');
      if (cb.checked) {
        selected.push(item.dataset.hostname);
      }
    });
    storageSet({ [STORAGE_KEY_SITES]: selected });
  }

  // site list is rendered in the unified storageGet callback above

  toggleAllBtn.addEventListener("click", () => {
    allSelected = !allSelected;
    siteListEl.querySelectorAll(".site-item").forEach((item, i) => {
      setTimeout(() => {
        const cb = item.querySelector('input[type="checkbox"]');
        cb.checked = allSelected;
        item.classList.toggle("selected", allSelected);
      }, i * 20);
    });
    setTimeout(saveSiteSelection, DEFAULT_SITES.length * 20 + 50);
  });

  // ============================================================
  //  HISTORY
  // ============================================================

  function closeAllPanels() {
    historyPanel.classList.add("hidden");
    tplPanel.classList.add("hidden");
    historyBtn.classList.remove("active-panel");
    tplSaveBtn.classList.remove("active-panel");
    tplLoadBtn.classList.remove("active-panel");
  }

  historyBtn.addEventListener("click", () => {
    const isOpen = !historyPanel.classList.contains("hidden");
    closeAllPanels();
    if (isOpen) { return; }
    historyBtn.classList.add("active-panel");
    historyPanel.classList.remove("hidden");
    loadHistoryPanel();
  });

  function loadHistoryPanel() {
    sendMsg({ type: "ASKALL_GET_HISTORY" }, (resp) => {
      const list = (resp && resp.history) || [];
      historyPanel.innerHTML = "";

      if (list.length === 0) {
        historyPanel.innerHTML = '<div class="dropdown-empty">No history yet</div>';
        return;
      }

      list.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "dropdown-item";

        const text = document.createElement("span");
        text.className = "dropdown-item-text";
        text.textContent = entry.question.slice(0, 100);

        const meta = document.createElement("span");
        meta.className = "dropdown-item-meta";
        meta.textContent = formatTimeAgo(entry.timestamp);

        row.appendChild(text);
        row.appendChild(meta);

        row.addEventListener("click", () => {
          questionEl.value = entry.question;
          questionEl.dispatchEvent(new Event("input"));
          closeAllPanels();
        });

        historyPanel.appendChild(row);
      });

      const footer = document.createElement("div");
      footer.className = "dropdown-footer";
      const clearBtn = document.createElement("button");
      clearBtn.className = "dropdown-footer-btn";
      clearBtn.textContent = "Clear All";
      clearBtn.addEventListener("click", () => {
        sendMsg({ type: "ASKALL_CLEAR_HISTORY" });
        historyPanel.innerHTML = '<div class="dropdown-empty">No history yet</div>';
      });
      footer.appendChild(clearBtn);
      historyPanel.appendChild(footer);
    });
  }

  function formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) { return "just now"; }
    if (mins < 60) { return mins + "m ago"; }
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) { return hrs + "h ago"; }
    const days = Math.floor(hrs / 24);
    return days + "d ago";
  }

  // ============================================================
  //  TEMPLATES
  // ============================================================

  tplSaveBtn.addEventListener("click", () => {
    const q = questionEl.value.trim();
    if (!q) {
      shakeElement(questionEl);
      return;
    }
    closeAllPanels();
    tplPanel.classList.remove("hidden");
    tplSaveBtn.classList.add("active-panel");

    tplPanel.innerHTML = "";
    const row = document.createElement("div");
    row.className = "tpl-save-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "tpl-save-input";
    input.placeholder = "Template name...";
    input.maxLength = 60;

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "tpl-save-confirm";
    confirmBtn.textContent = "Save";

    confirmBtn.addEventListener("click", () => {
      const name = input.value.trim() || q.slice(0, 40);
      saveTemplate(name, q);
      closeAllPanels();
      showToast("Template saved");
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { confirmBtn.click(); }
    });

    row.appendChild(input);
    row.appendChild(confirmBtn);
    tplPanel.appendChild(row);
    input.focus();
  });

  tplLoadBtn.addEventListener("click", () => {
    const isOpen = !tplPanel.classList.contains("hidden") && !tplSaveBtn.classList.contains("active-panel");
    closeAllPanels();
    if (isOpen) { return; }
    tplLoadBtn.classList.add("active-panel");
    tplPanel.classList.remove("hidden");
    loadTemplatesPanel();
  });

  function saveTemplate(name, question) {
    storageGet(STORAGE_KEY_TEMPLATES, (r) => {
      const templates = (r && r[STORAGE_KEY_TEMPLATES]) || [];
      templates.unshift({ name: name, question: question, timestamp: Date.now() });
      if (templates.length > 30) { templates.length = 30; }
      storageSet({ [STORAGE_KEY_TEMPLATES]: templates });
    });
  }

  function loadTemplatesPanel() {
    storageGet(STORAGE_KEY_TEMPLATES, (r) => {
      const templates = (r && r[STORAGE_KEY_TEMPLATES]) || [];
      tplPanel.innerHTML = "";

      if (templates.length === 0) {
        tplPanel.innerHTML = '<div class="dropdown-empty">No templates saved</div>';
        return;
      }

      templates.forEach((tpl, idx) => {
        const row = document.createElement("div");
        row.className = "dropdown-item";

        const text = document.createElement("span");
        text.className = "dropdown-item-text";
        text.textContent = tpl.name;

        const del = document.createElement("button");
        del.className = "dropdown-item-delete";
        del.innerHTML = "&times;";
        del.title = "Delete";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          templates.splice(idx, 1);
          storageSet({ [STORAGE_KEY_TEMPLATES]: templates });
          loadTemplatesPanel();
        });

        row.appendChild(text);
        row.appendChild(del);

        row.addEventListener("click", () => {
          questionEl.value = tpl.question;
          questionEl.dispatchEvent(new Event("input"));
          closeAllPanels();
        });

        tplPanel.appendChild(row);
      });
    });
  }

  // close panels when clicking outside
  document.addEventListener("click", (e) => {
    const isInToolbar = e.target.closest(".toolbar-actions") ||
      e.target.closest("#history-panel") ||
      e.target.closest("#tpl-panel");
    if (!isInToolbar) {
      closeAllPanels();
    }
  });

  // ============================================================
  //  QUESTION BUILDER
  // ============================================================

  function buildQuestion() {
    const raw = questionEl.value.trim();
    if (!raw) { return ""; }
    const checked = document.querySelectorAll(".strategy-cb:checked");
    let prefix = "";
    checked.forEach((cb) => {
      if (STRATEGY_MAP[cb.value]) { prefix += STRATEGY_MAP[cb.value]; }
    });
    return prefix + raw;
  }

  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch (_) { return false; }
  }

  function getSelectedUrls() {
    const urls = [];
    siteListEl.querySelectorAll(".site-item").forEach((item) => {
      const cb = item.querySelector('input[type="checkbox"]');
      if (cb.checked) { urls.push(item.dataset.url); }
    });
    const custom = customSitesEl.value.split("\n").map((l) => l.trim()).filter(isValidUrl).slice(0, MAX_CUSTOM_SITES);
    return urls.concat(custom);
  }

  // ============================================================
  //  SEND
  // ============================================================

  sendBtn.addEventListener("click", () => {
    if (sendInFlight) { return; }

    const question = buildQuestion();
    if (!question) { shakeElement(questionEl); questionEl.focus(); return; }

    const urls = getSelectedUrls();
    if (urls.length === 0) { shakeElement(toggleAllBtn); return; }

    sendInFlight = true;
    lastSentQuestion = question;
    sendBtn.disabled = true;
    sendBtn.classList.add("sending");
    sendBtn.textContent = "Checking...";
    collectBtn.disabled = false;
    prevDoneSet = new Set();

    statusBar.classList.remove("hidden", "all-done");
    statusBar.classList.add("section-enter");
    updateStatusUI("sending", 0, urls.length);

    responsesSection.classList.remove("hidden");
    responsesSection.classList.add("section-enter");
    responsesContainer.innerHTML = "";

    urls.forEach((url, i) => {
      const hn = safeHostname(url);
      appendResponseCard(hn, findSiteName(hn) || hn, i, url);
    });

    sendMsg({ type: "ASKALL_SEND", urls, question }, (resp) => {
      sendInFlight = false;
      if (resp && resp.success) {
        const skippedCount = (resp.skipped && resp.skipped.length) || 0;
        const activeCount = urls.length - skippedCount;
        if (activeCount > 0) {
          updateStatusUI("polling", skippedCount, urls.length);
          startPolling();
          // open persistent panel if running inside the popup (not already a detached window)
          if (!isDetachedWindow()) {
            const sizeMap = { s: 460, m: 600, l: 770 };
            const currentSize = document.body.getAttribute("data-size") || "m";
            sendMsg({
              type: "ASKALL_OPEN_PANEL",
              width: sizeMap[currentSize] || 600,
              height: 620,
            });
          }
        } else {
          updateStatusUI("error", 0, urls.length, "All sites unreachable.");
          resetSendButton();
        }
        if (skippedCount > 0) {
          showToast(`${skippedCount} site(s) unreachable, skipped`);
        }
      } else {
        updateStatusUI("error", 0, urls.length, (resp && resp.error) || "Failed to send.");
        resetSendButton();
      }
    });
  });

  function resetSendButton() {
    sendBtn.disabled = false;
    sendBtn.classList.remove("sending");
    sendBtn.textContent = "Send to All";
    sendInFlight = false;
  }

  // ============================================================
  //  STATUS UI
  // ============================================================

  function updateStatusUI(phase, done, total, errMsg) {
    const dot = statusBar.querySelector(".status-dot");
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    dot.style.background = "";

    if (phase === "sending") {
      dot.className = "status-dot active";
      statusLabel.textContent = `Checking ${total} sites...`;
      progressFill.className = "progress-fill active";
      progressFill.style.width = "5%";
    } else if (phase === "polling") {
      dot.className = "status-dot active";
      statusLabel.textContent = `${done} / ${total} complete`;
      progressFill.className = "progress-fill active";
      progressFill.style.width = Math.max(pct, 10) + "%";
    } else if (phase === "done") {
      dot.className = "status-dot done";
      statusLabel.textContent = "All responses collected";
      progressFill.className = "progress-fill done";
      progressFill.style.width = "100%";
      statusBar.classList.add("all-done");
    } else if (phase === "error") {
      dot.className = "status-dot";
      dot.style.background = "var(--danger)";
      statusLabel.textContent = errMsg || "Failed.";
    }
  }

  // ============================================================
  //  POLLING
  // ============================================================

  function startPolling() {
    stopPolling();
    pollIntervalId = setInterval(fetchStatus, 3000);
  }

  function stopPolling() {
    if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
  }

  function fetchStatus() {
    sendMsg({ type: "ASKALL_GET_STATUS" }, (resp) => {
      if (resp && resp.tabs) { updateResponseCards(resp.tabs); }
    });
  }

  collectBtn.addEventListener("click", (e) => {
    addRipple(collectBtn, e);
    collectBtn.textContent = "Collecting...";
    collectBtn.disabled = true;
    sendMsg({ type: "ASKALL_COLLECT_ALL" }, (resp) => {
      collectBtn.textContent = "Collect";
      collectBtn.disabled = false;
      if (resp && resp.tabs) { updateResponseCards(resp.tabs); }
    });
  });

  resetBtn.addEventListener("click", (e) => {
    addRipple(resetBtn, e);
    stopPolling();
    prevDoneSet = new Set();
    lastSentQuestion = "";
    sendInFlight = false;

    questionEl.value = "";
    questionEl.style.height = "auto";

    responsesContainer.innerHTML = "";
    responsesSection.classList.add("hidden");
    statusBar.classList.remove("all-done");
    statusBar.classList.add("hidden");

    resetSendButton();
    collectBtn.disabled = true;

    sendMsg({ type: "ASKALL_STOP_ALL" });
    showToast("Reset — ready for new question");
  });

  // ============================================================
  //  RESPONSE CARDS
  // ============================================================

  function safeHostname(url) {
    try { return new URL(url).hostname; } catch (_) { return url; }
  }

  function findSiteName(hn) {
    const m = DEFAULT_SITES.find((s) => s.hostname === hn);
    return m ? m.name : null;
  }

  function formatElapsed(ms) {
    if (!ms || ms < 0) { return "..."; }
    const sec = Math.round(ms / 1000);
    if (sec < 60) { return sec + "s"; }
    return Math.floor(sec / 60) + "m " + (sec % 60) + "s";
  }

  function appendResponseCard(hostname, siteName, index, url) {
    const card = document.createElement("div");
    card.className = "response-card collapsed";
    card.dataset.hostname = hostname;
    card.dataset.url = url;
    card.style.animationDelay = (index * 40) + "ms";

    card.innerHTML = `
      <div class="response-card-header">
        <span class="response-site-name">${escapeHtml(siteName)}</span>
        <span class="response-status pending">pending</span>
      </div>
      <div class="response-body response-body-empty"></div>
      <div class="response-stats">
        <span class="response-stat" data-stat="words">--</span>
        <span class="response-stat" data-stat="time">--</span>
      </div>
      <div class="response-card-actions">
        <button class="btn-retry hidden" data-url="${escapeHtml(url)}">Retry</button>
        <button class="btn-copy-single">Copy</button>
      </div>
    `;

    card.querySelector(".btn-copy-single").addEventListener("click", () => {
      const text = card.querySelector(".response-body").textContent || "";
      if (!text) { return; }
      copyText(text);
      const btn = card.querySelector(".btn-copy-single");
      btn.classList.add("copied");
      btn.textContent = "Copied";
      setTimeout(() => { btn.classList.remove("copied"); btn.textContent = "Copy"; }, 1200);
    });

    card.querySelector(".btn-retry").addEventListener("click", function () {
      this.classList.add("retrying");
      this.textContent = "Retrying...";
      sendMsg({ type: "ASKALL_RETRY_SITE", url: url }, (resp) => {
        this.classList.remove("retrying");
        this.textContent = "Retry";
        if (resp && resp.success) {
          this.classList.add("hidden");
          card.classList.remove("card-error");
          card.classList.add("collapsed");
          card.querySelector(".response-status").className = "response-status polling";
          card.querySelector(".response-status").textContent = "retrying";
          card.querySelector(".response-body").className = "response-body response-body-empty";
          card.querySelector(".response-body").textContent = "";
          prevDoneSet.delete(hostname);
          startPolling();
        }
      });
    });

    responsesContainer.appendChild(card);
  }

  function updateResponseCards(tabs) {
    let totalCount = 0;
    let doneCount = 0;

    for (const [_tabId, info] of Object.entries(tabs)) {
      totalCount++;
      const card = responsesContainer.querySelector(`.response-card[data-hostname="${info.hostname}"]`);
      if (!card) { continue; }

      const statusEl = card.querySelector(".response-status");
      const bodyEl = card.querySelector(".response-body");
      const retryBtn = card.querySelector(".btn-retry");
      const wordsStat = card.querySelector('[data-stat="words"]');
      const timeStat = card.querySelector('[data-stat="time"]');

      const isDone = info.status === "done" || info.status === "timeout";
      const isError = info.status === "error";
      const isSkipped = info.status === "skipped";
      const isPolling = info.status === "polling";

      if (isDone || isError || isSkipped) { doneCount++; }

      statusEl.className = "response-status";
      if (isDone) {
        statusEl.classList.add("done");
        statusEl.textContent = "done";
      } else if (isSkipped) {
        statusEl.classList.add("skipped");
        statusEl.textContent = "skipped";
      } else if (isError) {
        statusEl.classList.add("error");
        statusEl.textContent = "error";
      } else if (isPolling) {
        statusEl.classList.add("polling");
        statusEl.textContent = "streaming";
      } else {
        statusEl.classList.add("pending");
        statusEl.textContent = info.status || "pending";
      }

      // expand card when content arrives, done, error, or skipped
      const hasContent = !!info.response;
      if (hasContent || isDone || isError || isSkipped) {
        card.classList.remove("collapsed");
      }

      if (isSkipped) {
        card.classList.add("card-skipped");
      }

      if (info.response) {
        bodyEl.classList.remove("response-body-empty");
        bodyEl.textContent = info.response;
      }

      // stats
      if (info.wordCount > 0) {
        wordsStat.textContent = info.wordCount + " words";
      }
      timeStat.textContent = formatElapsed(info.elapsedMs);

      // retry button visibility
      if (isError) {
        retryBtn.classList.remove("hidden");
      } else {
        retryBtn.classList.add("hidden");
      }

      // done animation
      if (isDone && !prevDoneSet.has(info.hostname)) {
        prevDoneSet.add(info.hostname);
        card.classList.remove("card-done");
        void card.offsetWidth;
        card.classList.add("card-done");
      }
      if (isError && !prevDoneSet.has(info.hostname)) {
        prevDoneSet.add(info.hostname);
        card.classList.add("card-error");
      }
    }

    if (totalCount > 0) {
      if (doneCount >= totalCount) {
        stopPolling();
        updateStatusUI("done", doneCount, totalCount);
        resetSendButton();
      } else {
        updateStatusUI("polling", doneCount, totalCount);
      }
    }
  }

  // ============================================================
  //  EXPORT MARKDOWN
  // ============================================================

  exportMdBtn.addEventListener("click", (e) => {
    addRipple(exportMdBtn, e);
    const cards = responsesContainer.querySelectorAll(".response-card");
    if (cards.length === 0) { return; }

    const now = new Date().toISOString().slice(0, 16).replace("T", " ");
    let md = `# AskAll Comparison Report\n\n`;
    md += `**Date:** ${now}\n`;
    md += `**Question:** ${lastSentQuestion}\n\n---\n\n`;

    cards.forEach((card) => {
      const name = card.querySelector(".response-site-name").textContent;
      const status = card.querySelector(".response-status").textContent;
      const body = card.querySelector(".response-body").textContent;
      const words = card.querySelector('[data-stat="words"]').textContent;
      const time = card.querySelector('[data-stat="time"]').textContent;

      md += `## ${name}\n\n`;
      md += `> Status: ${status} | ${words} | ${time}\n\n`;
      md += `${body}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `askall-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported as Markdown");
  });

  // ============================================================
  //  COPY DEBUG
  // ============================================================

  copyDebugBtn.addEventListener("click", (e) => {
    addRipple(copyDebugBtn, e);
    copyDebugBtn.textContent = "Collecting...";
    copyDebugBtn.disabled = true;

    sendMsg({ type: "ASKALL_DEBUG_ALL" }, (resp) => {
      copyDebugBtn.textContent = "Debug";
      copyDebugBtn.disabled = false;

      if (!resp || !resp.debugEntries || resp.debugEntries.length === 0) {
        showToast("No errors to debug");
        return;
      }

      const now = new Date().toISOString();
      let report = `=== AskAll Debug Report ===\n`;
      report += `Time: ${now}\n`;
      report += `Question: ${resp.question || lastSentQuestion || "N/A"}\n`;
      report += `Error/Timeout sites: ${resp.debugEntries.length}\n`;
      report += `${"=".repeat(50)}\n\n`;

      resp.debugEntries.forEach((entry, idx) => {
        report += `--- [${idx + 1}] ${entry.hostname} ---\n`;
        report += `URL: ${entry.url}\n`;
        report += `Status: ${entry.status}\n`;
        report += `Error message: ${entry.response || "N/A"}\n`;
        report += `Sent at: ${entry.createdAt}\n`;
        report += `Failed at: ${entry.doneAt || "still pending"}\n`;
        report += `Elapsed: ${entry.elapsedMs}ms\n`;

        const d = entry.pageDiag;
        if (d && !d.error) {
          report += `Page title: ${d.pageTitle}\n`;
          report += `Current URL: ${d.currentUrl}\n`;
          report += `Adapter: ${d.adapterUsed}\n`;
          report += `Selectors:\n`;
          report += `  input: ${d.selectors.input}\n`;
          report += `  submit: ${d.selectors.submit}\n`;
          report += `  response: ${d.selectors.response}\n`;
          report += `  thinking: ${d.selectors.thinking}\n`;
          report += `DOM probe:\n`;
          report += `  inputFound: ${d.domProbe.inputFound} (${d.domProbe.inputTag || "-"})\n`;
          report += `  submitFound: ${d.domProbe.submitFound} (${d.domProbe.submitTag || "-"})\n`;
          report += `  responseCount: ${d.domProbe.responseCount}\n`;
          report += `  thinkingVisible: ${d.domProbe.thinkingVisible}\n`;
          report += `  lastResponseLength: ${d.lastResponseLength}\n`;
          report += `  stabilityCounter: ${d.stabilityCounter}\n`;
          if (d.errorHints && d.errorHints.length > 0) {
            report += `Page error hints:\n`;
            d.errorHints.forEach((hint) => {
              report += `  - ${hint.slice(0, 200)}\n`;
            });
          }
        } else if (d) {
          report += `Page diagnostics: ${d.error}\n`;
        }
        report += `\n`;
      });

      copyText(report);
      showToast("Debug report copied");
    });
  });

  // ============================================================
  //  CLIPBOARD
  // ============================================================

  copyAllBtn.addEventListener("click", (e) => {
    addRipple(copyAllBtn, e);
    const cards = responsesContainer.querySelectorAll(".response-card");
    if (cards.length === 0) { return; }
    let text = "";
    cards.forEach((card) => {
      const name = card.querySelector(".response-site-name").textContent;
      const body = card.querySelector(".response-body").textContent;
      text += `=== ${name} ===\n${body}\n\n`;
    });
    copyText(text.trim());
  });

  function copyText(text) {
    if (!text) { return; }
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied to clipboard");
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (_) { /* fallback failed */ }
      document.body.removeChild(ta);
      showToast("Copied to clipboard");
    });
  }

  let toastTimer = null;

  function showToast(message) {
    toastText.textContent = message || "Done";
    if (toastTimer) { clearTimeout(toastTimer); }
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => { toastEl.classList.remove("show"); toastTimer = null; }, 1800);
  }

  // ============================================================
  //  UTIL
  // ============================================================

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function isDetachedWindow() {
    return window.location.search.includes("detached=1");
  }

  // ============================================================
  //  DEFERRED FAVICON LOADING
  // ============================================================

  requestAnimationFrame(() => {
    document.querySelectorAll("img[data-lazy-src]").forEach((img) => {
      img.src = img.dataset.lazySrc;
    });
  });

  // ============================================================
  //  RESTORE STATE
  // ============================================================

  sendMsg({ type: "ASKALL_GET_STATUS" }, (resp) => {
    if (!resp || !resp.tabs) { return; }
    const entries = Object.entries(resp.tabs);
    if (entries.length === 0) { return; }

    if (resp.question) { lastSentQuestion = resp.question; }

    responsesSection.classList.remove("hidden");
    statusBar.classList.remove("hidden");
    collectBtn.disabled = false;

    entries.forEach(([_tabId, info], i) => {
      const existing = responsesContainer.querySelector(`.response-card[data-hostname="${info.hostname}"]`);
      if (!existing) {
        appendResponseCard(info.hostname, findSiteName(info.hostname) || info.hostname, i, info.url);
      }
    });

    updateResponseCards(resp.tabs);

    const hasPending = entries.some(([_, info]) => info.status === "polling" || info.status === "loading");
    if (hasPending) { startPolling(); }
  });
})();
