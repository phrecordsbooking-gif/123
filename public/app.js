/* ── State ── */
let conversationHistory = [];
let leads = [];
let currentFilter = 'ALL';

/* ── DOM refs ── */
const chatMessages = document.getElementById('chatMessages');
const userInput    = document.getElementById('userInput');
const sendBtn      = document.getElementById('sendBtn');
const leadForm     = document.getElementById('leadForm');
const saveMsg      = document.getElementById('saveMsg');
const leadsGrid    = document.getElementById('leadsGrid');
const scriptModal  = document.getElementById('scriptModal');
const scriptContent= document.getElementById('scriptContent');
const modalClose   = document.getElementById('modalClose');
const copyScriptBtn= document.getElementById('copyScript');

/* ── Tab navigation ── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });
    tab.classList.add('active');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    target.classList.remove('hidden');
    target.classList.add('active');
    if (tab.dataset.tab === 'leads') renderLeads();
  });
});

/* ── Quick prompts ── */
document.querySelectorAll('.qp').forEach(btn => {
  btn.addEventListener('click', () => {
    userInput.value = btn.dataset.prompt;
    userInput.focus();
  });
});

/* ── Send message ── */
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });
  userInput.value = '';
  sendBtn.disabled = true;

  const loadingEl = appendMessage('bot', '⏳ Thinking…', true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory }),
    });
    const data = await res.json();

    chatMessages.removeChild(loadingEl);

    if (data.error) {
      appendMessage('bot', '⚠️ ' + data.error);
    } else {
      const reply = data.message.content;
      appendMessage('bot', reply);
      conversationHistory.push({ role: 'assistant', content: reply });
    }
  } catch (err) {
    chatMessages.removeChild(loadingEl);
    appendMessage('bot', '⚠️ Could not reach the server. Make sure the app is running.');
  }

  sendBtn.disabled = false;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(role, text, isLoading = false) {
  const msg = document.createElement('div');
  msg.className = 'message ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'bot' ? 'K' : 'Me';

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (isLoading ? ' loading' : '');
  bubble.innerHTML = formatText(text);

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function formatText(text) {
  // Escape HTML first
  let safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text** (no newlines inside)
  safe = safe.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic *text* (no newlines inside)
  safe = safe.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
  // Bullet lists (lines starting with - or •)
  safe = safe.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  // Numbered lists
  safe = safe.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> blocks in <ul> — match only unwrapped items
  safe = safe.replace(/(<li>[^\n<]*<\/li>\n?)+/g, '<ul>$&</ul>');
  // Line breaks
  safe = safe.replace(/\n\n/g, '</p><p>');
  safe = safe.replace(/\n/g, '<br>');
  return '<p>' + safe + '</p>';
}

/* ── Save lead ── */
leadForm.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    name:            document.getElementById('lName').value.trim(),
    phone:           document.getElementById('lPhone').value.trim(),
    email:           document.getElementById('lEmail').value.trim(),
    vehicleInterest: document.getElementById('lVehicle').value.trim(),
    budget:          document.getElementById('lBudget').value.trim(),
    timeline:        document.getElementById('lTimeline').value,
    temperature:     document.getElementById('lTemp').value,
    notes:           document.getElementById('lNotes').value.trim(),
  };

  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Save failed');
    const lead = await res.json();
    leads.push(lead);

    leadForm.reset();
    saveMsg.classList.remove('hidden');
    setTimeout(() => saveMsg.classList.add('hidden'), 2500);
  } catch (err) {
    alert('Could not save lead: ' + err.message);
  }
});

/* ── Render leads ── */
async function loadLeads() {
  try {
    const res = await fetch('/api/leads');
    leads = await res.json();
  } catch (_) {
    leads = [];
  }
}

function renderLeads() {
  loadLeads().then(() => {
    const filtered = currentFilter === 'ALL'
      ? leads
      : leads.filter(l => l.temperature === currentFilter);

    leadsGrid.innerHTML = '';
    if (filtered.length === 0) {
      leadsGrid.innerHTML = '<p class="empty-state">No leads yet. Start a conversation and save your prospects!</p>';
      return;
    }

    filtered.forEach(lead => {
      const card = document.createElement('div');
      card.className = 'lead-card';
      card.innerHTML = `
        <span class="temp-badge ${lead.temperature}">${tempEmoji(lead.temperature)} ${lead.temperature}</span>
        <div class="lead-name">${escHtml(lead.name)}</div>
        ${lead.phone ? `<div class="lead-detail">📞 <span>${escHtml(lead.phone)}</span></div>` : ''}
        ${lead.email ? `<div class="lead-detail">✉️ <span>${escHtml(lead.email)}</span></div>` : ''}
        ${lead.vehicleInterest ? `<div class="lead-detail">🚗 <span>${escHtml(lead.vehicleInterest)}</span></div>` : ''}
        ${lead.budget ? `<div class="lead-detail">💰 <span>${escHtml(lead.budget)}</span></div>` : ''}
        ${lead.timeline ? `<div class="lead-detail">📅 <span>${escHtml(lead.timeline)}</span></div>` : ''}
        ${lead.notes ? `<div class="lead-detail">📝 <span>${escHtml(lead.notes)}</span></div>` : ''}
        <div class="lead-actions">
          <button class="btn-sm btn-script" data-id="${lead.id}">✉️ Get Script</button>
          <button class="btn-sm btn-del" data-id="${lead.id}">🗑 Delete</button>
        </div>
      `;
      leadsGrid.appendChild(card);
    });

    // Script buttons
    leadsGrid.querySelectorAll('.btn-script').forEach(btn => {
      btn.addEventListener('click', () => generateScript(btn.dataset.id));
    });
    // Delete buttons
    leadsGrid.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => deleteLead(btn.dataset.id));
    });
  });
}

/* ── Filter buttons ── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderLeads();
  });
});

/* ── Generate outreach script ── */
async function generateScript(id) {
  scriptContent.textContent = '⏳ Generating your personalized script…';
  scriptModal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/leads/${id}/script`, { method: 'POST' });
    const data = await res.json();
    scriptContent.textContent = data.script || data.error || 'Error generating script.';
  } catch (err) {
    scriptContent.textContent = 'Could not reach the server.';
  }
}

/* ── Delete lead ── */
async function deleteLead(id) {
  if (!confirm('Delete this lead?')) return;
  try {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    leads = leads.filter(l => l.id !== id);
    renderLeads();
  } catch (err) {
    alert('Delete failed.');
  }
}

/* ── Modal ── */
modalClose.addEventListener('click', () => scriptModal.classList.add('hidden'));
scriptModal.addEventListener('click', e => {
  if (e.target === scriptModal) scriptModal.classList.add('hidden');
});
copyScriptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(scriptContent.textContent)
    .then(() => { copyScriptBtn.textContent = '✅ Copied!'; setTimeout(() => { copyScriptBtn.textContent = '📋 Copy to Clipboard'; }, 2000); })
    .catch(() => alert('Copy failed – please select and copy manually.'));
});

/* ── Helpers ── */
function tempEmoji(t) { return { HOT: '🔥', WARM: '⚡', COLD: '❄️' }[t] || ''; }
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
