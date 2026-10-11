# Doctor Tracker

Secure administrative web app for managing doctors, their patients, and clinic analytics.

## Elevator pitch

Doctor Tracker is a calm clinical operations desk: authenticated admins sign in, manage doctor and patient registries with search/filter/pagination, and read caseload insights from a Recharts-powered dashboard — all over a REST API backed by MongoDB.

## Setup guide

### Prerequisites

- Node.js 20+
- Optional: MongoDB 7+ (if unset, an in-memory MongoDB starts automatically)

### Install

```bash
cd DoctorTracker
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run install:all
```

### Run locally

```bash
# Terminal 1 — API
npm run dev:backend
# → http://127.0.0.1:4821

# Terminal 2 — UI
npm run dev:frontend
# → http://127.0.0.1:4317
```

### Demo credentials

| Field | Value |
|-------|-------|
| Email | `admin@doctortracker.com` |
| Password | `Admin@123` |

See root `.env.example` and `backend/.env.example` / `frontend/.env.example`.

## System architecture

```
Browser (Next.js :4317)
   │  REST + JWT
   ▼
Express API (:4821)
   │  Mongoose + indexes
   ▼
MongoDB (external URI or memory server)
```

- **Auth:** `POST /api/auth/login` issues JWT; `requireAuth` guards doctors, patients, dashboard.
- **Doctors / patients:** CRUD + search + date/condition filters + pagination.
- **Dashboard:** aggregation pipelines for totals, patients-per-doctor, condition mix, 30-day trend.

## Technical decisions

1. **Split Next.js + Express** — Honors the REST client/server requirement, isolates API validation (Zod) and Mongo indexing from the UI, and keeps frontend deploys independent of API scaling.
2. **Memory Mongo fallback + real indexes** — Schemas define text/date indexes for search and pagination. Without `MONGODB_URI`, `mongodb-memory-server` still exercises the same models so demos never block on DB install.

## Design direction

Web references compared: Ember Dashboard, Clinova hospital admin, Spine clinical DS, CareIQ, Medixpro. Selected **Calm Clinical Teal** (Spine semantics + Clinova/Ember layout): light mint atmosphere, teal CTA, soft semantic badges, sidebar navigation, Fraunces display + Plus Jakarta Sans body.

## Visual evidence

Add desktop & mobile screenshots of Login, Dashboard, Doctors, and Patients after running the app.

## API map

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/doctors` | List / create |
| GET/PUT/DELETE | `/api/doctors/:id` | Detail / update / delete |
| GET/POST | `/api/doctors/:id/patients` | List / add under doctor |
| DELETE | `/api/doctors/:id/patients/:patientId` | Remove from doctor |
| GET/POST | `/api/patients` | List / create |
| PUT/DELETE | `/api/patients/:id` | Edit / delete |
| GET | `/api/dashboard/stats` | Analytics payload |
