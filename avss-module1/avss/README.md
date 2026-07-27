# AVSS — Autonomous Video Surveillance System

AI-powered Computer Vision application for automated video surveillance and missing persons detection. Final Year Project — BSCS, Lahore Garrison University.

## Module 1 — Project Setup ✅

This module establishes the foundation: backend, frontend, virtual environment, Git repo, Docker, and PostgreSQL connection.

## Module 3 — Dashboard UI ✅

A responsive frontend dashboard was added to display camera status, alerts, backend health, and overall system status.

## Module 4 — Intelligence Workflow 🚧

The repository now includes a dedicated frontend module structure for operational intelligence, alerts, and workflow monitoring to support the next phase of development.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, SQLAlchemy, JWT Auth |
| Database | PostgreSQL |
| AI (later modules) | YOLOv8, YOLOv8-Face, InsightFace, OSNet/FastReID, ByteTrack, FAISS |
| Infra | Docker, Nginx |

## Project Structure

```
avss/
├── backend/
│   ├── app/
│   │   ├── api/           # health/auth route handlers
│   │   ├── core/          # config and database setup
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # business logic
│   │   ├── utils/         # shared helpers
│   │   └── main.py        # FastAPI entrypoint
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
├── frontend/
│   ├── app/               # Next.js App Router pages
│   ├── components/        # reusable UI and module components
│   │   └── modules/
│   │       └── module4/   # Module 4 UI scaffolding
│   ├── lib/               # utilities
│   ├── package.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Setup Instructions

### Option A — Run with Docker (recommended)

```bash
# 1. Copy env file
cp backend/.env.example backend/.env

# 2. Build and start everything (Postgres + FastAPI + Next.js)
docker compose up --build
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:3000
- PostgreSQL: localhost:5432

### Option B — Run manually (no Docker)

**1. Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit DATABASE_URL if needed
uvicorn app.main:app --reload
```

**2. PostgreSQL**

Make sure PostgreSQL is running locally, then create the database:

```sql
CREATE DATABASE avss_db;
CREATE USER avss_user WITH PASSWORD 'avss_password';
GRANT ALL PRIVILEGES ON DATABASE avss_db TO avss_user;
```

**3. Frontend**

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

### Verify setup

Visit `http://localhost:3000` — the homepage pings the backend `/health` endpoint and shows whether the database is connected. You should see:

```json
{
  "status": "ok",
  "service": "AVSS Backend",
  "database_connected": true
}
```

## Git Setup

```bash
cd avss
git init
git add .
git commit -m "Module 1: Project setup - backend, frontend, Docker, PostgreSQL"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## Next Steps

- **Module 2** — Authentication System (Register, Login, JWT, Roles, Profile)
- **Module 3** — Dashboard (Home, Sidebar, Stats, Alerts, Camera Status)
- **Module 4** — Intelligence Workflow (Alerts queue, detection monitoring, operational metrics)

## Team

- **Developer:** Saad
- **Team Member:** Tazmeen Zameer
- **Supervisor:** Ms. Amna Nadeem
- **Institution:** Lahore Garrison University — BSCS Final Year Project
