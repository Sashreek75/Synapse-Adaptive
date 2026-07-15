# NeuroBridge

> AI-powered adaptive rehabilitation platform designed to make recovery more personalized, accessible, and intelligent.

---

## What this is

NeuroBridge is an AI-powered adaptive rehabilitation platform designed to make recovery more personalized, accessible, and intelligent for individuals undergoing physical or cognitive rehabilitation. Built entirely as a software-based solution, NeuroBridge uses artificial intelligence, computer vision, and real-time progress analytics to help patients recover more effectively from neurological and physical impairments while allowing clinicians and caregivers to monitor improvement with greater precision.

**Core features (this build):**
- AI-Powered Adaptive Rehabilitation Engine
- Computer Vision Movement Analysis
- Cognitive Rehabilitation Modules
- Intelligent Progress Analytics
- Personalized Recovery Pathways
- Gamified Recovery Experience

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Recharts, Tailwind CSS |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) |
| AI | Anthropic Claude API (coach + analysis + reports) |
| Voice | OpenAI Whisper API |
| Database | PostgreSQL 16 + TimescaleDB (time-series) |
| Cache / Queue | Redis + Celery |
| Storage | AWS S3 (audio files, PDFs) |

---

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python (v3.12+)
- PostgreSQL + TimescaleDB (running locally)
- Redis (running locally)
- An Anthropic API key (required)
- An OpenAI API key (optional — enables voice transcription)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/synapse-adaptive
cd synapse-adaptive

cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY
```

### 2. Start the app

```bash
npm install   # (Installs the root runner if not already done)
npm run dev   # Starts both backend and frontend concurrently
```

### 3. Open the app

Visit **http://localhost:3000** and create an account.

API docs (dev only): **http://localhost:8000/docs**

---

## Project Structure

```
synapse-adaptive/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + WebSocket endpoint
│   │   ├── core/                # Config, DB, JWT security
│   │   ├── api/v1/              # Route handlers (auth, health-data, journal, coach, reports)
│   │   ├── services/            # Business logic layer
│   │   ├── intelligence/        # Claude client, prompts, heuristics
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response types
│   │   └── tasks/               # Celery background workers
│   └── alembic/                 # Database migrations
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── dashboard/           # Main health overview
│   │   ├── coach/               # AI chat interface
│   │   ├── journal/             # Voice + text logging
│   │   ├── insights/            # AI insights feed
│   │   └── reports/             # Clinic PDF generator
│   └── lib/api.ts               # Typed API client
```

---

## API Reference

### Auth
```
POST /api/v1/auth/register    — Create account, returns JWT tokens
POST /api/v1/auth/login       — Login, returns JWT tokens
POST /api/v1/auth/refresh     — Refresh access token
```

### Health Data
```
POST /api/v1/health-data         — Ingest single metric
POST /api/v1/health-data/batch   — Batch ingest (up to 1000 points)
GET  /api/v1/health-data         — Query time-series data
GET  /api/v1/health-data/latest  — Latest reading per metric type
WS   /ws/stream                  — Real-time WebSocket streaming
```

### Journal
```
POST /api/v1/journal           — Submit text entry
POST /api/v1/journal/voice     — Upload audio (Whisper transcription)
GET  /api/v1/journal           — List entries (paginated)
GET  /api/v1/journal/{id}      — Single entry with AI analysis
```

### AI Coach
```
POST /api/v1/coach/message     — Streaming SSE chat (EventSource)
```

### Insights
```
GET   /api/v1/insights         — Full insights feed
GET   /api/v1/insights/summary — Today's daily summary
PATCH /api/v1/insights/{id}/read
```

### Reports
```
POST /api/v1/reports           — Request PDF generation (async, 202)
GET  /api/v1/reports           — List reports + status
GET  /api/v1/reports/{id}      — Report status + download URL
```

---

## How the AI works

### Voice Journal → Structured Data
1. User records audio → uploaded to S3
2. OpenAI Whisper transcribes audio to text
3. Celery queues background job
4. Claude analyzes text and extracts: mood score, energy, stress, symptoms, tags
5. Extracted numeric values auto-populate the `health_metrics` table
6. Analysis stored as JSONB on the journal entry

### AI Coach (Sage)
1. User sends message
2. Backend fetches last 7 days of metrics + last 3 journal entries
3. Health data injected into system prompt as context
4. Claude streams a personalized response
5. Frontend displays tokens in real-time via SSE

### Anomaly Detection
1. New metric arrives
2. System fetches 30 days of history for that metric/user
3. Computes personal baseline (mean ± 1.5σ)
4. If new value outside range → creates an `Insight` record with `severity: warning`

### Clinic Reports
1. User requests a report for a date range
2. Celery job collects all metrics for that period
3. Claude generates a narrative summary from the aggregated data
4. ReportLab builds a formatted PDF
5. PDF uploaded to S3 with presigned download URL

---

## Data Model

```
users ──< devices
users ──< health_metrics  (TimescaleDB hypertable, partitioned by time)
users ──< journal_entries (JSONB ai_analysis field)
users ──< insights        (daily_summary | anomaly | trend | recommendation)
users ──< reports         (pending → generating → ready)
```

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWTs signed with HS256, short-lived access tokens (24h) + refresh tokens (30d)
- All S3 objects encrypted at rest (AES-256)
- All API traffic over HTTPS in production
- No user data in logs
- HIPAA-aware design (audit trail via `created_at`/`updated_at` on all tables)

---

## Environment Variables

See `.env.example` for the full list. Required:
- `SECRET_KEY` — JWT signing key (generate with `openssl rand -hex 32`)
- `ANTHROPIC_API_KEY` — Powers the AI coach, journal analysis, and report generation
- `DATABASE_URL` + `DATABASE_URL_SYNC`

Optional (features degrade gracefully without them):
- `OPENAI_API_KEY` — Voice transcription (Whisper)
- `AWS_*` — File storage (audio + PDFs saved to /tmp in dev)

---

## Next Steps (Post-MVP)

### Immediate (Week 2-4)
- [ ] Apple Health / Google Fit OAuth integration
- [ ] Email notifications for anomaly alerts
- [ ] User profile + settings page
- [ ] Mobile-responsive layout

### Near-term (Month 2-3)
- [ ] Stripe billing integration (free tier → Pro)
- [ ] Wearable device SDK (initial hardware integration)
- [ ] Clinician dashboard (separate read-only view)
- [ ] FHIR/HL7 structured report export

### Scaling (Month 4+)
- [ ] Kafka for high-frequency streaming ingestion
- [ ] Custom ML models for fatigue/stress prediction
- [ ] React Native mobile app
- [ ] SOC 2 Type II audit preparation
- [ ] Multi-region deployment (AWS + GCP)

---

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Run tests: `cd backend && pytest`
3. Open a PR with a clear description

---

*Built with care. Your health data stays yours.*
