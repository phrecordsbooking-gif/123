/* ═══════════════════════════════════════════════════════════════
   app.js  –  LeadBot client-side logic
   Kia of Portland AI Lead Assistant
═══════════════════════════════════════════════════════════════ */

// ── Conversation history kept in-tab (resets on page refresh)
// Capped at the last 20 messages to control token costs and payload size.
let conversationHistory = [];
const MAX_HISTORY = 20;

// ── Lead summary regex  (matches the LEAD SUMMARY block the AI emits)
const LEAD_SUMMARY_RE =
  /---LEAD SUMMARY---([\s\S]*?)---END LEAD SUMMARY---/i;

// ─────────────────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${target}`).classList.add("active");
    if (target === "leads") loadLeads();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById("chatMessages");
const chatForm     = document.getElementById("chatForm");
const chatInput    = document.getElementById("chatInput");
const sendBtn      = document.getElementById("sendBtn");

// Submit on Enter (Shift+Enter = new line)
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  chatInput.value = "";
  sendBtn.disabled = true;

  const typingId = appendTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    removeTyping(typingId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      appendMessage("assistant", `⚠️ ${err.error || "Something went wrong. Please try again."}`);
    } else {
      const data = await res.json();
      const reply = data.reply || "";

      // Check for embedded lead summary
      const match = reply.match(LEAD_SUMMARY_RE);
      if (match) {
        const cleaned = reply.replace(LEAD_SUMMARY_RE, "").trim();
        appendMessage("assistant", cleaned);
        await autoSaveLead(match[1].trim());
      } else {
        appendMessage("assistant", reply);
      }

      conversationHistory.push({ role: "assistant", content: reply });
      // Trim history to avoid ever-growing token payloads
      if (conversationHistory.length > MAX_HISTORY) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY);
      }
    }
  } catch {
    removeTyping(typingId);
    appendMessage("assistant", "⚠️ Network error – please check your connection and try again.");
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
});

// Quick-start buttons
document.querySelectorAll(".qs-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    chatInput.value = btn.dataset.prompt;
    chatForm.requestSubmit();
  });
});

function appendMessage(role, rawText) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = formatMarkdown(rawText);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function appendTyping() {
  const id = `typing-${Date.now()}`;
  const div = document.createElement("div");
  div.className = "msg assistant typing";
  div.id = id;
  div.innerHTML = `<div class="msg-bubble">LeadBot is thinking…</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/** Very light Markdown → HTML (bold, italic, lists, headings, line breaks) */
function formatMarkdown(text) {
  return text
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Paragraphs / line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    // Wrap loose <li> in <ul>
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Wrap everything in a paragraph
    .replace(/^(?!<[hup])(.+)/, "<p>$1</p>");
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SAVE LEAD FROM AI SUMMARY BLOCK
// ─────────────────────────────────────────────────────────────────────────────
async function autoSaveLead(summaryText) {
  const get = (key) => {
    const m = summaryText.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
    return m ? m[1].trim() : "Unknown";
  };

  const lead = {
    name:     get("name"),
    contact:  get("contact"),
    interest: get("interest"),
    score:    get("score"),
    notes:    get("notes"),
  };

  // Validate score value
  if (!["Hot", "Warm", "Cold"].includes(lead.score)) lead.score = "Warm";

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (res.ok) {
      showToast(`✅ Lead saved: ${lead.name} (${lead.score === "Hot" ? "🔥" : lead.score === "Warm" ? "☀️" : "🌱"} ${lead.score})`);
    }
  } catch {
    // Silently ignore auto-save errors
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const leadsContainer = document.getElementById("leadsContainer");
const statsBar       = document.getElementById("statsBar");
const filterScore    = document.getElementById("filterScore");
const filterStatus   = document.getElementById("filterStatus");

let allLeads = [];

filterScore.addEventListener("change",  renderLeads);
filterStatus.addEventListener("change", renderLeads);

async function loadLeads() {
  try {
    const res = await fetch("/api/leads");
    const data = await res.json();
    allLeads = data.leads || [];
    renderStats();
    renderLeads();
  } catch {
    leadsContainer.innerHTML = `<div class="empty-state">⚠️ Could not load leads. Please refresh.</div>`;
  }
}

function renderStats() {
  const hot  = allLeads.filter((l) => l.score === "Hot").length;
  const warm = allLeads.filter((l) => l.score === "Warm").length;
  const cold = allLeads.filter((l) => l.score === "Cold").length;
  statsBar.innerHTML = `
    <div class="stat-card"><div class="stat-num">${allLeads.length}</div><div class="stat-lbl">Total Leads</div></div>
    <div class="stat-card hot"><div class="stat-num">${hot}</div><div class="stat-lbl">🔥 Hot</div></div>
    <div class="stat-card warm"><div class="stat-num">${warm}</div><div class="stat-lbl">☀️ Warm</div></div>
    <div class="stat-card cold"><div class="stat-num">${cold}</div><div class="stat-lbl">🌱 Cold</div></div>
  `;
}

function renderLeads() {
  const scoreF  = filterScore.value;
  const statusF = filterStatus.value;
  const filtered = allLeads.filter((l) => {
    if (scoreF  && l.score  !== scoreF)  return false;
    if (statusF && l.status !== statusF) return false;
    return true;
  });

  if (filtered.length === 0) {
    leadsContainer.innerHTML = `<div class="empty-state">No leads found. Start chatting with the AI assistant to generate leads!</div>`;
    return;
  }

  leadsContainer.innerHTML = filtered.map((lead) => `
    <div class="lead-card ${escHtml(lead.score)}" data-id="${escHtml(lead.id)}">
      <div class="lead-card-top">
        <div class="lead-name">${escHtml(lead.name)}</div>
        <span class="lead-score-badge badge-${escHtml(lead.score)}">
          ${lead.score === "Hot" ? "🔥" : lead.score === "Warm" ? "☀️" : "🌱"} ${escHtml(lead.score)}
        </span>
      </div>
      ${lead.contact && lead.contact !== "Unknown" ? `<div class="lead-contact">${escHtml(lead.contact)}</div>` : ""}
      ${lead.interest ? `<div class="lead-interest">${escHtml(lead.interest)}</div>` : ""}
      ${lead.notes ? `<div class="lead-notes">${escHtml(lead.notes)}</div>` : ""}
      <div class="lead-meta">
        <select class="lead-status-sel" data-id="${escHtml(lead.id)}">
          <option value="new"         ${lead.status === "new"         ? "selected" : ""}>New</option>
          <option value="contacted"   ${lead.status === "contacted"   ? "selected" : ""}>Contacted</option>
          <option value="appointment" ${lead.status === "appointment" ? "selected" : ""}>Appointment</option>
          <option value="sold"        ${lead.status === "sold"        ? "selected" : ""}>Sold ✅</option>
          <option value="lost"        ${lead.status === "lost"        ? "selected" : ""}>Lost ❌</option>
        </select>
        <div class="lead-actions">
          <span style="font-size:11px;color:#bbb;">${formatDate(lead.createdAt)}</span>
          <button class="btn-delete" data-id="${escHtml(lead.id)}" title="Delete lead">🗑</button>
        </div>
      </div>
    </div>
  `).join("");

  // Status change
  leadsContainer.querySelectorAll(".lead-status-sel").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      await patchLead(e.target.dataset.id, { status: e.target.value });
    });
  });

  // Delete buttons
  leadsContainer.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (!confirm("Delete this lead?")) return;
      await deleteLead(e.target.dataset.id);
    });
  });
}

async function patchLead(id, body) {
  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const idx = allLeads.findIndex((l) => l.id === id);
      if (idx !== -1) allLeads[idx] = data.lead;
      renderStats();
    }
  } catch {
    showToast("⚠️ Could not update lead.");
  }
}

async function deleteLead(id) {
  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      allLeads = allLeads.filter((l) => l.id !== id);
      renderStats();
      renderLeads();
      showToast("Lead deleted.");
    }
  } catch {
    showToast("⚠️ Could not delete lead.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD LEAD MODAL
// ─────────────────────────────────────────────────────────────────────────────
const leadModal   = document.getElementById("leadModal");
const addLeadBtn  = document.getElementById("addLeadBtn");
const cancelBtn   = document.getElementById("cancelLeadBtn");
const leadForm    = document.getElementById("leadForm");

addLeadBtn.addEventListener("click", () => leadModal.classList.remove("hidden"));
cancelBtn.addEventListener("click",  () => { leadModal.classList.add("hidden"); leadForm.reset(); });
leadModal.addEventListener("click",  (e) => { if (e.target === leadModal) { leadModal.classList.add("hidden"); leadForm.reset(); } });

leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(leadForm);
  const body = Object.fromEntries(fd.entries());

  // Client-side validation
  if (!body.name || !body.name.trim()) {
    showToast("⚠️ Name is required.");
    return;
  }
  if (!["Hot", "Warm", "Cold"].includes(body.score)) {
    showToast("⚠️ Please select a valid lead score.");
    return;
  }

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      allLeads.unshift(data.lead);
      renderStats();
      renderLeads();
      leadModal.classList.add("hidden");
      leadForm.reset();
      showToast(`✅ Lead added: ${body.name}`);
    } else {
      const err = await res.json();
      showToast(`⚠️ ${err.error}`);
    }
  } catch {
    showToast("⚠️ Could not save lead.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// API STATUS CHECK
// ─────────────────────────────────────────────────────────────────────────────
async function checkApiStatus() {
  const dot  = document.getElementById("apiStatusDot");
  const text = document.getElementById("apiStatusText");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply && data.reply.includes("demo mode")) {
        dot.className  = "status-dot demo";
        text.textContent = "Demo mode (no API key)";
      } else {
        dot.className  = "status-dot live";
        text.textContent = "AI connected ✓";
      }
    } else {
      throw new Error("non-ok");
    }
  } catch {
    dot.className  = "status-dot error";
    text.textContent = "Connection error";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

let toastTimer;
function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;background:#1A1A1A;color:#fff;
      padding:12px 20px;border-radius:10px;font-size:14px;z-index:9999;
      box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = "0"; }, 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
checkApiStatus();
