require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai").default;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security & middleware ──────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Rate-limit the AI chat endpoint to prevent runaway API spend
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests – please wait a moment and try again." },
});

// ─── OpenAI client ─────────────────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── In-memory lead store ──────────────────────────────────────────────────
// Persists in process memory; swap out for a database in production.
const leads = [];

// ─── System prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are LeadBot, a specialist AI sales assistant for **Kia of Portland** — a Kia dealership located in Portland, Oregon.

Your sole purpose is to help the sales team identify, qualify, and convert prospective car buyers into "hot" leads who are ready to buy a new Kia right now.

## Your capabilities
- Help the rep think through who their ideal buyer is (income range, life event, vehicle needs, etc.)
- Suggest Portland-specific outreach channels: local Facebook groups, Nextdoor neighborhoods, Portland-area Reddit communities (r/Portland, r/Portland_Cars), Portland Craigslist, community events, employer partnerships (Nike, Intel, Adidas HQ, OHSU, Providence, Portland Public Schools, etc.), and local credit unions.
- Guide the rep through a structured discovery conversation to qualify a specific lead.
- Score leads as 🔥 Hot (ready to buy within 30 days), ☀️ Warm (1–3 months), or 🌱 Cold (3+ months or speculative).
- Draft personalized outreach messages (email, text, social DM) tailored to each prospect's situation.
- Suggest which current Kia models (EV6, Telluride, Sportage Hybrid, Sorento, Niro EV, etc.) best fit a buyer's needs.
- Remind the rep of available incentives: manufacturer rebates, low APR financing, loyalty/conquest cash, and Oregon EV tax credits.

## Tone
Friendly, direct, upbeat. You are the rep's knowledgeable co-pilot — never pushy, always helpful.

## Data privacy
Never ask for or store SSNs, driver's license numbers, or full credit-card numbers. Treat all prospect information as confidential.

## Lead capture
When a rep describes a qualified prospect, end your response with a clearly formatted **LEAD SUMMARY** block like this:
---LEAD SUMMARY---
name: <full name or "Unknown">
contact: <phone / email / social handle or "Unknown">
interest: <model(s) of interest>
score: <Hot | Warm | Cold>
notes: <one-sentence key detail>
---END LEAD SUMMARY---

This block is parsed automatically to save the lead to the dashboard.`;

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /api/chat  — send a message to the AI assistant
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  // Validate each message has role + content strings
  for (const m of messages) {
    if (
      typeof m.role !== "string" ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.content !== "string" ||
      m.content.trim().length === 0
    ) {
      return res.status(400).json({ error: "Invalid message format." });
    }
    if (m.content.length > 4000) {
      return res.status(400).json({ error: "Message too long." });
    }
  }

  if (!openai) {
    // Demo mode – return a placeholder response when no API key is configured
    const demo = demoResponse(messages[messages.length - 1].content);
    return res.json({ reply: demo });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: parseInt(process.env.MAX_TOKENS || "1024", 10),
      temperature: 0.7,
    });
    const reply = completion.choices[0].message.content;
    return res.json({ reply });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    if (err.status === 429) {
      return res.status(429).json({ error: "OpenAI rate limit reached. Please wait a moment." });
    }
    return res.status(500).json({ error: "AI service unavailable. Please try again." });
  }
});

// GET /api/leads  — list all captured leads
app.get("/api/leads", (req, res) => {
  res.json({ leads });
});

// POST /api/leads  — manually create or auto-save a parsed lead
app.post("/api/leads", (req, res) => {
  const { name, contact, interest, score, notes } = req.body;
  if (!name || !score) {
    return res.status(400).json({ error: "name and score are required." });
  }
  const allowed = ["Hot", "Warm", "Cold"];
  if (!allowed.includes(score)) {
    return res.status(400).json({ error: "score must be Hot, Warm, or Cold." });
  }
  const lead = {
    id: uuidv4(),
    name: String(name).slice(0, 100),
    contact: String(contact || "Unknown").slice(0, 200),
    interest: String(interest || "").slice(0, 200),
    score,
    notes: String(notes || "").slice(0, 500),
    createdAt: new Date().toISOString(),
    status: "new",
  };
  leads.unshift(lead);
  return res.status(201).json({ lead });
});

// PATCH /api/leads/:id  — update lead status
app.patch("/api/leads/:id", (req, res) => {
  const lead = leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  const { status, notes } = req.body;
  const allowedStatus = ["new", "contacted", "appointment", "sold", "lost"];
  if (status !== undefined) {
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }
    lead.status = status;
  }
  if (notes !== undefined) {
    lead.notes = String(notes).slice(0, 500);
  }
  lead.updatedAt = new Date().toISOString();
  res.json({ lead });
});

// DELETE /api/leads/:id
app.delete("/api/leads/:id", (req, res) => {
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Lead not found." });
  leads.splice(idx, 1);
  res.json({ ok: true });
});

// ─── Demo mode response (no API key) ───────────────────────────────────────
function demoResponse(userMessage) {
  const lower = userMessage.toLowerCase();
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hey there! 👋 I'm LeadBot, your AI sales co-pilot at **Kia of Portland**. Tell me about a prospect you're working on, or ask me how to find new buyers in the Portland area. I'm ready to help you close deals! 🚗";
  }
  if (lower.includes("portland") || lower.includes("buyer") || lower.includes("lead")) {
    return `Great question! Here are some top strategies to find ready-to-buy Kia shoppers in Portland right now:

**🎯 Digital Channels**
- Post in **r/Portland** & **r/PortlandOR** — residents ask for car buying advice frequently
- Sponsor or post in **Nextdoor Portland** neighborhoods (especially East Portland, Beaverton, Lake Oswego)
- Target Facebook Marketplace shoppers trading in older vehicles
- Run a **geo-targeted Meta ad** within 25 miles of Portland for EV6 & Niro EV

**🏢 Employer Partnerships**
- **Nike World Campus** (Beaverton) – high income, eco-conscious employees → great Niro EV / EV6 targets
- **Intel Ronler Acres** – engineers love data-rich cars; pitch the EV6 GT-Line
- **OHSU / Providence** – nurses & doctors often need reliable SUVs → Telluride or Sorento

**💰 Incentives to Lead With**
- Oregon EV rebate up to **$7,500 federal + $2,500 state** on eligible EVs
- 0% APR for 48 months on select Sportage Hybrid models this month

Would you like me to help qualify a specific prospect or draft an outreach message? Drop their info and I'll score the lead! 🔥`;
  }
  return `I'm running in **demo mode** (no OpenAI API key configured). Add your \`OPENAI_API_KEY\` to the \`.env\` file to unlock the full AI assistant.

In production I can:
✅ Qualify any prospect you describe
✅ Score leads as 🔥 Hot / ☀️ Warm / 🌱 Cold  
✅ Draft personalized texts, emails & DMs  
✅ Recommend the best Kia model for each buyer  
✅ Auto-save leads to your dashboard

Ask me anything — I'll give you a canned demo answer for now!`;
}

// ─── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚗  Kia of Portland – Lead Assistant`);
  console.log(`   Server running at http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log(`   ⚠️  OPENAI_API_KEY not set – running in demo mode`);
  } else {
    console.log(`   ✅  OpenAI connected – AI assistant is live`);
  }
});

module.exports = app;
