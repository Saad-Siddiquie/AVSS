# AVSS — Autonomous Video Surveillance System

AI-powered Computer Vision application for automated video surveillance and missing persons detection. Final Year Project — BSCS, Lahore Garrison University.

## Module 1 — Project Setup ✅

This module establishes the foundation: backend, frontend, virtual environment, Git repo, Docker, and PostgreSQL connection.

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
│   │   ├── core/          # config, database connection
│   │   ├── api/           # route handlers
│   │   ├── models/        # SQLAlchemy ORM models (Module 2+)
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # business logic
│   │   ├── utils/         # helpers
│   │   └── main.py        # FastAPI entrypoint
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # shadcn/ui + custom components (Module 3+)
│   ├── lib/                # utilities
│   ├── package.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml
└── .gitignore
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

## Team

- **Developer:** Saad
- **Team Member:** Tazmeen Zameer
- **Supervisor:** Ms. Amna Nadeem
- **Institution:** Lahore Garrison University — BSCS Final Year Project
