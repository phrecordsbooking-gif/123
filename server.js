require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Lazily create the OpenAI client so the server can start without a key configured
let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// In-memory lead storage (replace with a database in production)
let leads = [];

// ── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are "Kai", an expert AI sales assistant for Kia of Portland, Oregon.
Your role is to help the sales team identify, qualify, and engage prospective car buyers in the Portland metro area.

Your capabilities:
1. LEAD QUALIFICATION – Ask smart discovery questions to determine:
   - Budget range and financing readiness (cash buyer, pre-approved, needs financing)
   - Timeline to purchase (buying today, within 30 days, just browsing)
   - Vehicle needs (family size, commute distance, cargo needs, fuel preference)
   - Trade-in status
   - Credit situation awareness
2. PORTLAND MARKET INSIGHTS – Understand local buying triggers:
   - Portland commuters favor fuel-efficient vehicles; highlight Kia's hybrids/EVs (EV6, Niro EV, Sportage Hybrid)
   - Rainy/outdoor-lifestyle buyers: Telluride, Sportage AWD
   - Young Portland professionals: Soul, Forte, EV6
   - Families in suburbs (Beaverton, Lake Oswego, Gresham): Sorento, Telluride, Carnival
3. HOT-LEAD SCORING – Rate every prospect:
   - 🔥 HOT  – Ready to buy within 7 days, has financing or cash
   - ⚡ WARM – Buying within 30 days, needs light nurturing
   - ❄️ COLD – Researching, long timeline; schedule follow-up
4. OUTREACH SCRIPTS – Generate personalized text/email scripts tailored to each prospect's stated interests.
5. OBJECTION HANDLING – Counter common objections ("I'm just looking", price concerns, brand hesitation).

When a user gives you a lead's name, contact info, or details, extract and summarize:
- Name, phone/email
- Vehicle interest
- Budget
- Timeline
- Lead temperature (HOT/WARM/COLD)
- Recommended next action

Always be friendly, energetic, and focused on helping close deals. Use real Portland neighborhoods and landmarks when personalizing outreach.`;

// ── Chat endpoint ────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file.',
    });
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const reply = completion.choices[0].message;
    res.json({ message: reply });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(500).json({ error: 'AI service error: ' + err.message });
  }
});

// ── Lead endpoints ────────────────────────────────────────────────────────────
app.get('/api/leads', (req, res) => {
  res.json(leads);
});

app.post('/api/leads', (req, res) => {
  const { name, phone, email, vehicleInterest, budget, timeline, temperature, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const lead = {
    id: require('crypto').randomUUID(),
    name,
    phone: phone || '',
    email: email || '',
    vehicleInterest: vehicleInterest || '',
    budget: budget || '',
    timeline: timeline || '',
    temperature: temperature || 'COLD',
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };

  leads.push(lead);
  res.status(201).json(lead);
});

app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  leads.splice(index, 1);
  res.json({ success: true });
});

// ── Generate outreach script ─────────────────────────────────────────────────
app.post('/api/leads/:id/script', async (req, res) => {
  const lead = leads.find((l) => l.id === req.params.id);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'OpenAI API key not configured.',
    });
  }

  const prompt = `Generate a short, personalized outreach text message AND email script for this Portland car buyer prospect. Make it friendly, local, and compelling:
Name: ${lead.name}
Vehicle Interest: ${lead.vehicleInterest || 'undecided'}
Budget: ${lead.budget || 'unknown'}
Timeline: ${lead.timeline || 'unknown'}
Lead Temp: ${lead.temperature}
Notes: ${lead.notes || 'none'}

Format:
TEXT MESSAGE (under 160 chars):
...

EMAIL SUBJECT:
...

EMAIL BODY:
...`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 512,
    });

    res.json({ script: completion.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(500).json({ error: 'AI service error: ' + err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Kia Portland Lead Assistant' });
});

app.listen(PORT, () => {
  console.log(`\n🚗  Kia Portland Lead Assistant running on http://localhost:${PORT}`);
  console.log(`   OpenAI key: ${process.env.OPENAI_API_KEY ? '✅ configured' : '❌ MISSING – set OPENAI_API_KEY in .env'}\n`);
});

module.exports = app;
