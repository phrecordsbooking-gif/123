# LeadBot – AI Lead Generation Assistant for Kia of Portland

An AI-powered web application that helps the sales team at **Kia of Portland** find, qualify, and manage prospective car buyers across the Portland metro area.

---

## Features

| Feature | Description |
|---|---|
| **AI Chat Assistant** | GPT-powered chat pre-configured to know Kia models, current incentives, Oregon EV credits, and Portland-area buyer channels |
| **Lead Scoring** | Auto-scores prospects as 🔥 Hot (≤30 days), ☀️ Warm (1–3 months), or 🌱 Cold (3+ months) |
| **Auto Lead Capture** | AI automatically extracts and saves structured lead records from conversations |
| **Leads Dashboard** | View, filter, update status, and delete leads from a visual card grid |
| **Quick-Start Prompts** | One-click prompts for common tasks (find Portland buyers, qualify a prospect, draft outreach messages, pitch EV6 vs Prius, etc.) |
| **Demo Mode** | Works without an API key so you can explore the UI right away |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your OpenAI key
```bash
cp .env.example .env
# Edit .env and paste your OpenAI API key
```

### 3. Run the server
```bash
npm start
# → http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No* | — | OpenAI API key. Without it, app runs in demo mode |
| `MAX_TOKENS` | No | `1024` | Max tokens per AI response (lower = cheaper) |
| `PORT` | No | `3000` | HTTP port |

> ⚠️ **Data persistence**: Leads are stored in process memory and **will be lost on server restart**. For production use, swap the in-memory array in `server.js` for a database (PostgreSQL, SQLite, etc.).

\* The app fully works in demo mode for UI exploration and manual lead management.

---

## API Reference

### `POST /api/chat`
Send a conversation turn to the AI assistant.

**Request body**
```json
{
  "messages": [
    { "role": "user", "content": "I have a prospect who works at Nike..." }
  ]
}
```

**Response**
```json
{ "reply": "Great prospect! Here's how I'd qualify them…" }
```

---

### `GET /api/leads`
Return all leads.

```json
{ "leads": [ { "id": "…", "name": "Jane Smith", "score": "Hot", … } ] }
```

---

### `POST /api/leads`
Manually create a lead.

```json
{
  "name": "Jane Smith",
  "contact": "503-555-0100",
  "interest": "EV6 GT-Line",
  "score": "Hot",
  "notes": "Ready to buy end of month"
}
```

---

### `PATCH /api/leads/:id`
Update lead status or notes.

```json
{ "status": "appointment" }
```

Valid statuses: `new`, `contacted`, `appointment`, `sold`, `lost`

---

### `DELETE /api/leads/:id`
Delete a lead.

---

## How to Generate Leads with the AI

1. **Open the AI Assistant tab**
2. **Try a quick-start prompt** (sidebar) or type your own question, for example:
   - *"Find me hot buyers in the Beaverton/Hillsboro area for a Kia EV6"*
   - *"My prospect Sarah works at Nike, has 2 kids, and drives a 2016 CX-5 with 110k miles. Is she a hot lead?"*
   - *"Draft a follow-up text for someone who test-drove a Telluride but hasn't called back"*
3. The AI scores the prospect and – when enough information is available – **automatically saves a lead card** to the Leads Dashboard.
4. Switch to **Leads Dashboard** to see, filter, update status, and manage all your leads.

---

## Deployment (Azure)

This repo includes a GitHub Actions workflow (`.github/workflows/azure-webapps-node.yml`) for deploying to Azure App Service.

1. Create an Azure Web App (Node 20 LTS)
2. Download the publish profile and save it as the `AZURE_WEBAPP_PUBLISH_PROFILE` secret
3. Set `AZURE_WEBAPP_NAME` in the workflow file
4. Add `OPENAI_API_KEY` as an App Service environment variable (Application Settings)
5. Push to `main` — the workflow deploys automatically

---

## Tech Stack

- **Backend**: Node.js + Express
- **AI**: OpenAI `gpt-4o-mini` (configurable)
- **Frontend**: Vanilla HTML / CSS / JavaScript (no build step)
- **Storage**: In-process memory (swap for PostgreSQL / SQLite in production)
- **Security**: Helmet, CORS, rate limiting on AI endpoint
