# Kai – Kia of Portland AI Lead Assistant

> **"Kai"** is an AI-powered sales assistant that helps the team at **Kia of Portland** identify, qualify, and engage prospective car buyers in the Portland metro area — turning inquiries into hot, money-ready leads.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 AI Chat | Conversational assistant powered by OpenAI GPT — ask anything about leads, objections, or the Portland market |
| 📊 Lead Scoring | Automatically categorizes prospects as 🔥 HOT, ⚡ WARM, or ❄️ COLD |
| 💾 Lead Manager | Save, view, filter, and manage all your prospects in one place |
| ✉️ Outreach Scripts | One-click personalized text message & email scripts for each lead |
| 💡 Sales Playbook | Portland-specific buyer segments, objection busters, and EV incentive info |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your OpenAI API key

```bash
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY
```

Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

> **Recommended model:** `gpt-4o-mini` — fast, affordable, and more than capable for this use case.

### 3. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗺️ Portland Buyer Segments (Built-In Knowledge)

Kai already knows:

- **NE/SE Portland young professionals** → EV6, Niro EV, Soul  
- **Beaverton/Hillsboro families** → Sorento, Telluride, Carnival  
- **SW Portland commuters** → Forte, Sportage Hybrid, Niro HEV  
- **Gresham/East County value buyers** → Rio, Forte, Sportage  
- **Lake Oswego / West Linn premium buyers** → EV6 GT-Line, Telluride SX-P  

---

## 💬 Example Conversations

**Qualify a walk-in:**
> "What questions should I ask a new walk-in to quickly find out if they're ready to buy?"

**Score a prospect:**
> "Marcus, 38, from Beaverton. Two kids. Looking at the Telluride. Pre-approved at $55k. Wants to buy before school starts."

**Handle an objection:**
> "Customer says the price is too high. How do I respond?"

**Generate a follow-up:**
> "Generate a text message for someone who test drove the EV6 yesterday but hasn't responded."

---

## 🏗️ Architecture

```
kia-portland-lead-assistant/
├── server.js          # Express API server + OpenAI integration
├── public/
│   ├── index.html     # Single-page app
│   ├── styles.css     # UI styling
│   └── app.js         # Frontend logic
├── .env.example       # Environment variable template
├── package.json
└── README.md
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message to the AI assistant |
| `GET` | `/api/leads` | List all saved leads |
| `POST` | `/api/leads` | Save a new lead |
| `DELETE` | `/api/leads/:id` | Delete a lead |
| `POST` | `/api/leads/:id/script` | Generate outreach script for a lead |
| `GET` | `/health` | Health check |

---

## ☁️ Deployment (Azure)

This repo includes a GitHub Actions workflow (`.github/workflows/azure-webapps-node.yml`) for deploying to Azure App Service.

1. Create an Azure App Service (Node.js 20).
2. Set `AZURE_WEBAPP_NAME` in the workflow file.
3. Add `AZURE_WEBAPP_PUBLISH_PROFILE` as a GitHub secret.
4. Add `OPENAI_API_KEY` as an App Service Application Setting in Azure.
5. Push to `main` to trigger deployment.

---

## 🔐 Security Notes

- Your `OPENAI_API_KEY` is **never** exposed to the browser — all AI calls go through the server.
- The `.env` file is gitignored by default.
- For production, use a proper database (e.g., Azure Cosmos DB, PostgreSQL) instead of in-memory storage.
