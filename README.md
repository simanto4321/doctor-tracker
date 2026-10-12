# Doctor Tracker

Secure administrative web app for managing doctors, their patients, and clinic analytics.

## Description

Doctor Tracker is a calm clinical operations desk: authenticated staff sign in with role-based access, manage doctor and patient registries with search/filter/pagination/CSV export, and read caseload insights from a Recharts-powered dashboard — all over a REST API backed by MongoDB.

## Setup Guide

### Prerequisites

- Node.js 20+
- Optional: MongoDB Atlas (or local MongoDB 7+) — if `MONGODB_URI` is unset, an in-memory MongoDB starts automatically
- Optional: Redis for dashboard aggregation cache (`REDIS_URL`)
- Optional: SMTP (`SMTP_URL`) for real email; otherwise messages go to the email outbox + console

### Install

```bash
cd DoctorTracker
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run install:all
```

### MongoDB Atlas

1. Create a free Atlas cluster and database user.
2. Allow your IP (or `0.0.0.0/0` for demos).
3. Set in `backend/.env`:

```bash
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/doctor-tracker?retryWrites=true&w=majority
```

Without `MONGODB_URI`, the API uses `mongodb-memory-server` so demos still boot.

### Run locally

```bash
# Terminal 1 — API
npm run dev:backend
# → http://127.0.0.1:4821
# → Swagger UI http://127.0.0.1:4821/api/docs

# Terminal 2 — UI
npm run dev:frontend
# → http://127.0.0.1:4317
```

### Tests

```bash
npm run test          # Vitest unit tests (backend)
npm run test:e2e --prefix frontend   # Playwright (API + UI must be running)
```

### Demo credentials (env-driven — not hardcoded in UI)

Set accounts in `backend/.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seeded admin |
| `RECEPTIONIST_EMAIL` / `RECEPTIONIST_PASSWORD` / `RECEPTIONIST_NAME` | Seeded receptionist |
| `SHOW_DEMO_ACCOUNTS` / `SHOW_DEMO_PASSWORDS` | Login “Demo logins” panel via `GET /api/auth/demo-accounts` |
| `CLIENT_ORIGIN` | Comma-separated CORS origins |
| `CLINIC_TIMEZONE` | IANA zone for date-only filters (e.g. `Asia/Dhaka`, `UTC`) |
| `NEXT_PUBLIC_API_URL` | Frontend API base |
| `NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL` (optional) | Prefill login email locally only |

Defaults ship for local demos; change any value and restart — the login UI loads accounts from the API.

Admin-only: **Team** registration + **Audit log**.  
Receptionist: create/edit doctors & patients.  
Doctor role: read-focused access (mutations blocked by API + UI).

Forgot password demo: `/forgot-password` (reset token returned in API response).  
Email verify demo: `/verify-email` (token from register response / outbox when SMTP is unset).

See `.env.example`, `backend/.env.example`, and `frontend/.env.example`.

## System Architecture

```
Browser (Next.js :4317)
   │  REST + JWT / httpOnly cookies · credentials include
   ▼
Express API (:4821)
   │  Zod · rate limits · requireAuth / requireRole · audit · Redis cache
   ▼
MongoDB Atlas (or memory server) + optional Redis + SMTP outbox
```

- **Auth:** access JWT + rotating refresh tokens in httpOnly cookies, login lockout, email verification, forgot/reset password.
- **Platform:** global + auth rate limits, activity email digests, Swagger/OpenAPI at `/api/docs`, Redis/memory cache for dashboard stats.
- **Interop:** HMAC-signed webhooks (`/api/webhooks`) and FHIR-lite Bundles (`/api/fhir/*`).
- **Doctors / patients:** CRUD + edit UI + CSV export + search/filter/pagination + detail charts.
- **Scheduling:** appointments with book/reschedule and calendar day view.
- **Clinical chart:** visits, prescriptions, labs, vitals, condition history, referrals, documents.
- **Ops:** hospitals/departments, bulk CSV import, soft-delete trash/restore, Cmd+K search, notifications.
- **Hover insights:** nav + feature titles + row hovers show live stats via `/api/insights/hover/:feature`.
- **UX boosters:** dark/light theme, i18n (EN / বাংলা / ES / FR / हिन्दी / العربية), sortable table columns, skeleton loaders, delete undo toasts, create wizards, empty-state illustrations, a11y (skip link, ARIA, focus, contrast).
- **Audit:** admin-readable log of create/update/delete/login/import actions.
- **Dashboard:** date-range picker, hospital/specialty filters, gender & age charts, specialization heatmap, hospital comparison, doctor utilization, PNG/PDF export, saved presets (cached aggregations).

## Technical Decisions

1. **Split Next.js + Express** — Matches the REST client/server requirement, keeps API validation and Mongo indexing outside the UI bundle, and lets frontend/API scale independently.
2. **RBAC in JWT + route guards** — Role is signed into the token and enforced with `requireRole` on mutating endpoints; the UI also hides create/edit/admin nav for non-admin/receptionist users so demos make the permission model obvious.

## Design direction

Calm Clinical Teal: light mint canvas, teal primary actions, pastel badges, Fraunces + Plus Jakarta Sans, sidebar operations desk.

## High-value product features

| Feature | Where |
|---------|--------|
| Appointments / day view | `/appointments` — book, reschedule, hour grid |
| Doctor detail + caseload chart | `/doctors/[id]` |
| Patient chart timeline | `/patients/[id]` — notes, vitals, labs, conditions |
| Visits / encounters | Log on patient detail; listed on doctor detail |
| Prescriptions | `/prescriptions` — dosage + refill status |
| Lab results + trends | `/labs` |
| Notifications | Header bell — follow-ups, assignments |
| Global search Cmd+K | Header search / ⌘K |
| Bulk CSV import | `/import` |
| Soft delete + restore | Delete → `/trash` (admin) |
| Hospitals / departments | `/hospitals` + doctor hospital filter |
| Working hours | Doctor form + detail profile |
| Referral tracking | `/referrals` |
| Document uploads | `/documents` (Mongo-backed demo storage) |
| Hover feature details | Info icons + underlined rows across the app |
| Refresh cookies + lockout | httpOnly `dt_access` / `dt_refresh`; `/api/auth/refresh` |
| Email verification + digests | `/verify-email`, `POST /api/platform/digests/run` |
| Swagger / OpenAPI | `/api/docs`, `/api/openapi.json` |
| Webhooks (HMAC) | `POST /api/webhooks` — events on doctor/patient/appointment create |
| FHIR-lite export | `/api/fhir/Patient`, `/Practitioner`, `/Bundle/$export` |
| Redis dashboard cache | set `REDIS_URL`; response includes `_cache` hit metadata |
| AI note summary | Patient chart → **AI note summary** (`GET /api/patients/:id/ai-summary`) |
| Risk flags | High BP / diabetes follow-up alerts on patient chart |
| Staff messages | `/messages` — internal inbox/sent |
| Telemedicine | `/telemedicine` — join link + status placeholder |
| Ward occupancy | `/wards` — bed board by hospital ward |
| Billing / invoices | `/billing` — invoices tied to visits |

## Assignment polish features

| Feature | Where |
|---------|--------|
| Doctor edit/update UI | Doctors page pencil → edit modal (`PUT /api/doctors/:id`) |
| CSV export | Doctors + Patients **CSV** buttons |
| Register | Team page (admin) → `POST /api/auth/register` |
| Forgot password | `/forgot-password` |
| Role-based access | JWT roles + API `requireRole` + UI gating |
| Audit log | `/audit` (admin) |

## Visual Evidence

### Desktop

Compact web captures (light | dark), resized for GitHub README fit.

| Login | Dashboard | Doctors |
|:---:|:---:|:---:|
| <img src="docs/screenshots/desktop-login.png" alt="Desktop login light" width="280" /> | <img src="docs/screenshots/desktop-dashboard.png" alt="Desktop dashboard light" width="280" /> | <img src="docs/screenshots/desktop-doctors.png" alt="Desktop doctors light" width="280" /> |
| <img src="docs/screenshots/desktop-login-dark.png" alt="Desktop login dark" width="280" /> | <img src="docs/screenshots/desktop-dashboard-dark.png" alt="Desktop dashboard dark" width="280" /> | <img src="docs/screenshots/desktop-doctors-dark.png" alt="Desktop doctors dark" width="280" /> |

| Doctor edit | Patients | Team |
|:---:|:---:|:---:|
| <img src="docs/screenshots/desktop-doctor-edit.png" alt="Desktop doctor edit light" width="280" /> | <img src="docs/screenshots/desktop-patients.png" alt="Desktop patients light" width="280" /> | <img src="docs/screenshots/desktop-team-register.png" alt="Desktop team light" width="280" /> |
| <img src="docs/screenshots/desktop-doctor-edit-dark.png" alt="Desktop doctor edit dark" width="280" /> | <img src="docs/screenshots/desktop-patients-dark.png" alt="Desktop patients dark" width="280" /> | <img src="docs/screenshots/desktop-team-register-dark.png" alt="Desktop team dark" width="280" /> |

| Audit | Forgot password |
|:---:|:---:|
| <img src="docs/screenshots/desktop-audit.png" alt="Desktop audit light" width="280" /> | <img src="docs/screenshots/desktop-forgot-password.png" alt="Desktop forgot password light" width="280" /> |
| <img src="docs/screenshots/desktop-audit-dark.png" alt="Desktop audit dark" width="280" /> | <img src="docs/screenshots/desktop-forgot-password-dark.png" alt="Desktop forgot password dark" width="280" /> |

### Mobile

Compact phone frames (light | dark). Images are resized for GitHub README fit.

| Login | Dashboard | Filters |
|:---:|:---:|:---:|
| <img src="docs/screenshots/mobile-login.png" alt="Mobile login light" width="180" /> | <img src="docs/screenshots/mobile-dashboard.png" alt="Mobile dashboard light" width="180" /> | <img src="docs/screenshots/mobile-dashboard-top.png" alt="Mobile filters light" width="180" /> |
| <img src="docs/screenshots/mobile-login-dark.png" alt="Mobile login dark" width="180" /> | <img src="docs/screenshots/mobile-dashboard-dark.png" alt="Mobile dashboard dark" width="180" /> | <img src="docs/screenshots/mobile-dashboard-top-dark.png" alt="Mobile filters dark" width="180" /> |

| Doctors | Patients | Audit |
|:---:|:---:|:---:|
| <img src="docs/screenshots/mobile-doctors.png" alt="Mobile doctors light" width="180" /> | <img src="docs/screenshots/mobile-patients.png" alt="Mobile patients light" width="180" /> | <img src="docs/screenshots/mobile-audit.png" alt="Mobile audit light" width="180" /> |
| <img src="docs/screenshots/mobile-doctors-dark.png" alt="Mobile doctors dark" width="180" /> | <img src="docs/screenshots/mobile-patients-dark.png" alt="Mobile patients dark" width="180" /> | <img src="docs/screenshots/mobile-audit-dark.png" alt="Mobile audit dark" width="180" /> |

## API map (core)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Admin registers user |
| POST | `/api/auth/forgot-password` | Issue reset token |
| POST | `/api/auth/reset-password` | Reset with token |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/doctors` | List / create |
| PUT/DELETE | `/api/doctors/:id` | Update / soft-delete |
| GET | `/api/doctors/export.csv` | Export doctors |
| GET/POST | `/api/patients` | List / create |
| PUT/DELETE | `/api/patients/:id` | Update / soft-delete |
| GET | `/api/patients/export.csv` | Export patients |
| GET | `/api/audit` | Admin audit trail |
| GET | `/api/dashboard/stats` | Analytics (`from`/`to`/`hospital`/`specialization`) |
| GET/POST/DELETE | `/api/dashboard/presets` | Saved dashboard filter presets |
| GET/POST | `/api/appointments` | Schedule / list |
| PUT | `/api/appointments/:id` | Reschedule / status |
| GET/POST | `/api/labs` | Lab results |
| GET | `/api/labs/trends/:patientId` | Lab trend series |
| GET/POST | `/api/referrals` | Referral tracking |
| GET/POST | `/api/documents` | Document upload/list |
| GET | `/api/hospitals` | Hospitals + departments |
| POST | `/api/import/doctors` · `/patients` | Bulk CSV import |
| POST | `/api/doctors/:id/restore` · `/patients/:id/restore` | Soft-delete restore |
| GET | `/api/insights/hover/:feature` | Live hover tooltips |

## Submission

- **GitHub:** https://github.com/simanto4321/doctor-tracker
- **Live frontend:** https://doctor-tracker-sigma.vercel.app
- **Live backend API:** https://doctor-tracker-api.vercel.app/api
- **API health:** https://doctor-tracker-api.vercel.app/api/health
- **Swagger docs:** https://doctor-tracker-api.vercel.app/api/docs
- **Demo credentials** (defaults from env; override via `ADMIN_*` / `RECEPTIONIST_*`; also listed live at `/api/auth/demo-accounts`):

| Role | Email (default) | Password (default) |
|------|-------|----------|
| Admin | `admin@doctortracker.com` | `Admin@123` |
| Receptionist | `front.desk@doctortracker.com` | `Desk@123` |
