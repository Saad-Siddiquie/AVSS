# AVSS — Autonomous Video Surveillance System

AI-powered Computer Vision application for automated video surveillance and missing persons detection. Final Year Project — BSCS, Lahore Garrison University.

## Module 1 — Project Setup ✅

Establishes the foundation: backend, frontend, virtual environment, Git repo, Docker, and PostgreSQL connection.

## Module 2 — Authentication System ✅

Full JWT-based authentication: register, login, token refresh, logout, and role-based access control.

## Module 3 — Dashboard UI ✅

Responsive frontend dashboard displaying camera status, backend health, system statistics, and module overviews.

## Module 4 — Camera Management ✅

Full CRUD for camera sources: add, list, get, update, and delete cameras.
Supports RTSP streams, webcams/USB cameras, and video file paths.
All endpoints are JWT-protected. Frontend includes a dedicated `/cameras` page.

## Module 5 — Video Processing ✅

Video ingestion scaffold: OpenCV pipeline, local video and RTSP stream support, frame extraction, FPS control.

## Module 6 — Person Detection ✅

YOLOv8 detection scaffold: person detection, bounding boxes, and confidence scores.

## Module 7 — Face Detection ✅

YOLOv8-Face scaffold: face detection, face cropping, and face saving pipeline.

## Module 8 — Face Recognition ✅

InsightFace scaffold: face embedding generation, person registration, and face comparison.

## Module 9 — Person Registration ✅

Registration workflow: upload person photo, name, age, gender, description, and embedding storage scaffold.

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
│   │   ├── api/           # health, auth, and module route handlers
│   │   ├── core/          # config and database setup
│   │   ├── models/        # SQLAlchemy ORM models (User, RefreshToken)
│   │   ├── schemas/       # Pydantic schemas (auth, module4–9)
│   │   ├── services/      # business logic (auth)
│   │   ├── utils/         # helpers (security, role-based auth)
│   │   └── main.py        # FastAPI entrypoint
│   ├── tests/             # pytest tests (auth, health, module endpoints)
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── README.md
├── frontend/
│   ├── app/               # Next.js App Router pages and layout
│   ├── components/        # reusable UI and module components
│   │   └── modules/
│   │       ├── module4/   # Intelligence Workflow (overview, metrics, alerts)
│   │       ├── module5/   # Video Processing Workflow
│   │       ├── module6/   # Person Detection Workflow
│   │       ├── module7/   # Face Detection Workflow
│   │       ├── module8/   # Face Recognition Workflow
│   │       └── module9/   # Person Registration Workflow (with form)
│   ├── lib/               # utilities (cn helper)
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

- **Module 5** — Video Processing (OpenCV pipeline, RTSP/webcam/file ingestion, frame extraction, FPS control)
- **Module 6** — Person Detection (YOLOv8, bounding boxes, confidence scores)
- **Module 7** — Face Detection (YOLOv8-Face, crop & save faces)
- **Module 8** — Face Recognition (InsightFace, embeddings, matching)
- **Module 10** — Similarity Search (FAISS)
- **Module 11** — Person Re-Identification (OSNet)
- **Module 12** — Multi-Object Tracking (ByteTrack)
- **Module 13** — Detection Logs
- **Module 14** — Search System
- **Module 15** — Alert System
- **Module 16** — Reports
- **Module 17** — Admin Panel
- **Module 18** — Deployment (Docker, Nginx, HTTPS)

## Team

- **Developer:** Saad
- **Team Member:** Tazmeen Zameer
- **Supervisor:** Ms. Amna Nadeem
- **Institution:** Lahore Garrison University — BSCS Final Year Project






Final Year Project Summary
Project Title
AVSS – Autonomous Video Surveillance System
Project Overview
AVSS is an AI-powered Computer Vision application designed to automate video surveillance. The system processes CCTV or IP camera video streams, detects people in real time, recognizes registered individuals, tracks them across multiple cameras, and generates alerts when a target person is found.
The system integrates multiple pretrained AI models with a modern web application, providing a complete surveillance platform for monitoring, searching, and managing security events.

Project Objectives
    • Detect people from CCTV cameras. 
    • Detect and recognize faces. 
    • Search for a specific person using a reference image. 
    • Track a person across multiple cameras. 
    • Maintain detection history. 
    • Generate real-time alerts. 
    • Provide a professional web dashboard. 
    • Support both recorded videos and live CCTV/IP camera streams. 

Technology Stack
Frontend
    • Next.js 
    • Tailwind CSS 
    • shadcn/ui 
Backend
    • FastAPI 
    • SQLAlchemy 
    • JWT Authentication 
Database
    • PostgreSQL 
AI Models
    • YOLOv8 (Person Detection) 
    • YOLOv8-Face (Face Detection) 
    • InsightFace (Face Recognition) 
    • OSNet/FastReID (Person Re-Identification) 
    • ByteTrack (Multi-Object Tracking) 
    • FAISS (Similarity Search) 
Other Libraries
    • OpenCV 
    • NumPy 
    • Docker 
    • Nginx 

Project Architecture
Camera / Video

↓

Frame Extraction

↓

Person Detection (YOLO)

↓

Face Detection (YOLO Face)

↓

Face Recognition (InsightFace)

↓

Person Re-ID (OSNet)

↓

Tracking (ByteTrack)

↓

FAISS Search

↓

PostgreSQL

↓

Dashboard

↓

Alerts

Development Modules

Module 1 — Project Setup
Goal
Create the complete project structure.
Tasks
    • Backend setup 
    • Frontend setup 
    • Virtual environment 
    • Git repository 
    • Docker 
    • PostgreSQL connection 

Module 2 — Authentication System
Features
    • Register 
    • Login 
    • JWT Authentication 
    • Roles 
    • Profile Management 

Module 3 — Dashboard
Features
    • Home Dashboard 
    • Sidebar 
    • Statistics 
    • Recent Alerts 
    • Camera Status 
    • Detection Summary 

Module 4 — Camera Management
Features
    • Add Camera 
    • Edit Camera 
    • Delete Camera 
    • RTSP Support 
    • Webcam Support 
    • Video Upload 

Module 5 — Video Processing
Features
    • OpenCV 
    • Read Video 
    • Read RTSP 
    • Frame Extraction 
    • FPS Control 

Module 6 — Person Detection
Model
YOLOv8
Features
    • Detect Person 
    • Bounding Boxes 
    • Confidence Score 

Module 7 — Face Detection
Model
YOLOv8-Face
Features
    • Detect Face 
    • Crop Face 
    • Save Face 

Module 8 — Face Recognition
Model
InsightFace
Features
    • Generate Face Embeddings 
    • Register Person 
    • Compare Faces 

Module 9 — Person Registration
Features
    • Upload Person Photo 
    • Name 
    • Age 
    • Gender 
    • Description 
    • Store Embeddings 

Module 10 — Similarity Search
Tool
FAISS
Features
    • Store Embeddings 
    • Search Similar Faces 
    • Ranking 
    • Distance Calculation 

Module 11 — Person Re-Identification
Model
OSNet
Features
    • Clothing Matching 
    • Body Features 
    • Appearance Matching 

Module 12 — Multi Object Tracking
Model
ByteTrack
Features
    • Assign IDs 
    • Maintain IDs 
    • Track Across Frames 

Module 13 — Detection Logs
Features
    • Save Detection 
    • Timestamp 
    • Camera 
    • Snapshot 
    • Confidence 

Module 14 — Search System
Features
Search Person
Search by Name
Search by Image
Search History

Module 15 — Alert System
Features
Target Found
Popup
Notification
Alert History

Module 16 — Reports
Features
Daily Report
Weekly Report
Monthly Report
Detection Statistics

Module 17 — Admin Panel
Features
Manage Users
Manage Cameras
Manage Missing Persons
Manage Logs

Module 18 — Deployment
Features
Docker
Nginx
Production Server
HTTPS

Database Tables
    • Users 
    • Roles 
    • Cameras 
    • Persons 
    • Face Embeddings 
    • Detection Logs 
    • Tracking Logs 
    • Alerts 
    • Search History 
    • Settings 

Final Workflow
User

↓

Login

↓

Dashboard

↓

Select Camera

↓

Video Stream

↓

YOLO Person Detection

↓

YOLO Face Detection

↓

InsightFace

↓

Generate Embeddings

↓

FAISS Search

↓

Person Match?

↓

YES

↓

OSNet Verification

↓

ByteTrack Tracking

↓

Save Detection

↓

Alert

↓

Dashboard Update

Project Timeline
Phase
Modules
Phase 1
Project Setup + Database + Authentication
Phase 2
Dashboard + Camera Management
Phase 3
Video Processing
Phase 4
Person Detection
Phase 5
Face Detection
Phase 6
Face Recognition
Phase 7
Person Registration
Phase 8
FAISS Search
Phase 9
Person Re-Identification
Phase 10
Multi-Object Tracking
Phase 11
Detection Logs
Phase 12
Search Module
Phase 13
Alert System
Phase 14
Reports & Analytics
Phase 15
Deployment & Testing
Recommended Development Strategy
Develop the project module by module, ensuring each module is fully functional before moving to the next. This avoids confusion and makes debugging much easier.
Recommended order:
    1. Project Setup 
    2. Database 
    3. Authentication 
    4. Dashboard 
    5. Camera Management 
    6. Video Processing 
    7. Person Detection 
    8. Face Detection 
    9. Face Recognition 
    10. Person Registration 
    11. FAISS Search 
    12. Person Re-Identification 
    13. Multi-Object Tracking 
    14. Detection Logs 
    15. Search System 
    16. Alert System 
    17. Reports & Analytics 
    18. Deployment & Final Testing 
This sequence builds a solid foundation first and then incrementally adds the AI capabilities, resulting in a maintainable and production-like AI surveillance application.
