# Copilot Instructions for LeadBot – Kia of Portland

## Project Overview

**LeadBot** is an AI-powered lead generation and management assistant for the sales team at **Kia of Portland**, a car dealership in Portland, Oregon. It helps sales representatives find, qualify, score, and manage prospective car buyers.

## Tech Stack

- **Runtime**: Node.js (≥ 18)
- **Backend framework**: Express 4
- **AI provider**: OpenAI (`gpt-4o-mini`) via the `openai` npm package
- **Frontend**: Vanilla HTML / CSS / JavaScript served from the `public/` directory — no build step, no framework
- **Security middleware**: `helmet`, `cors`, `express-rate-limit`
- **Lead IDs**: `uuid` (v4)
- **Config**: `dotenv` (`.env` file, see `.env.example`)
- **Storage**: In-process memory array (`leads` in `server.js`) — no database

## Repository Structure

```
server.js          # Single-file Express backend: routes, AI integration, demo mode
public/            # Static frontend assets served by Express
.env.example       # Template for required environment variables
.github/
  workflows/
    azure-webapps-node.yml  # CI/CD to Azure App Service
```

## Running the Project

```bash
npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm start              # → http://localhost:3000
```

No build step is required. The app runs in **demo mode** (canned responses) when `OPENAI_API_KEY` is not set.

## Key Architecture Decisions

- **Single-file backend**: All server logic lives in `server.js`. Keep it that way unless a refactor is explicitly requested.
- **In-memory storage**: Leads are stored in a plain JavaScript array. This resets on every server restart. Any persistence work should swap this array for a database (PostgreSQL or SQLite recommended).
- **Demo mode**: When `OPENAI_API_KEY` is absent, `/api/chat` returns hardcoded responses from `demoResponse()` so the UI can be exercised without API costs.
- **Lead capture via AI**: The AI is instructed (via `SYSTEM_PROMPT`) to append a structured `---LEAD SUMMARY---` block to qualifying responses. The frontend parses this block and POSTs to `/api/leads` automatically.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/chat` | Send conversation turns to the AI assistant (rate-limited: 15 req/min) |
| `GET` | `/api/leads` | List all leads |
| `POST` | `/api/leads` | Create a lead (requires `name` and `score`) |
| `PATCH` | `/api/leads/:id` | Update lead `status` or `notes` |
| `DELETE` | `/api/leads/:id` | Delete a lead |

Valid lead scores: `Hot`, `Warm`, `Cold`  
Valid lead statuses: `new`, `contacted`, `appointment`, `sold`, `lost`

## Coding Conventions

- Use `require()` (CommonJS), not ES module `import`.
- All route handlers use the `(req, res)` pattern; no third-party router files.
- Input is validated inline at the top of each route handler before any business logic.
- String fields are clamped with `.slice(0, N)` to enforce max lengths (name: 100, contact/interest: 200, notes: 500).
- Errors are returned as `{ error: "<message>" }` JSON with an appropriate HTTP status code.
- The `openai` client is initialized once at startup; check `if (!openai)` to handle demo mode.
- Do not introduce a database, ORM, or additional framework without explicit direction.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI key; omit to run in demo mode |
| `MAX_TOKENS` | No | `1024` | Max tokens per AI response |
| `PORT` | No | `3000` | HTTP listen port |

## Security Notes

- The AI endpoint is rate-limited (`express-rate-limit`) to 15 requests per minute.
- `helmet` is configured with a strict Content Security Policy.
- The `SYSTEM_PROMPT` instructs the AI never to request SSNs, driver's license numbers, or credit card numbers.
- Never commit real API keys; use the `.env` file (already in `.gitignore`).
