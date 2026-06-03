# PICU Research Platform

<img width="1512" height="858" alt="image" src="https://github.com/user-attachments/assets/260d63a6-f848-458c-b6e8-a857e4237ea7" />


A full-stack clinical research platform for pediatric intensive care. Combines patient data management with AI-powered academic search, statistical analysis, and scientific writing tools — all in one interface.

## Features

| Module | Description |
|---|---|
| **Patient Scan** | Search and track PICU patient records via Elasticsearch |
| **Academic Search** | AI-powered literature search with Consensus API |
| **Library** | Personal reference library linked to Supabase |
| **Projects** | Research project management |
| **Records** | Clinical data records |
| **Data Entry** | Structured patient data input |
| **Statistics** | Statistical analysis and visualizations |
| **Figures** | Chart and figure generation |
| **Tables** | Dynamic data tables |
| **Writing** | AI-assisted academic writing |
| **Reviewer** | Manuscript review assistant |

## Tech Stack

**Frontend** — React 18, Vite, Tailwind CSS, served via Nginx  
**Backend** — Node.js 22, Express.js  
**Database** — Supabase (PostgreSQL + Auth)  
**Search** — Elasticsearch 8.13  
**AI** — OpenAI GPT, DeepSeek, Consensus API, Brave Search

<img width="1512" height="858" alt="image" src="https://github.com/user-attachments/assets/3680a276-56e1-41cd-8783-361fc5e1a96c" />

## Architecture

```
browser → Nginx :3000 → React SPA
                ↓
         Express :5001
          ├── Supabase (auth + DB)
          └── Elasticsearch :9200 (patient search)
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Supabase project
- API keys (see below)

### 1. Clone and configure

```bash
git clone https://github.com/MustRick/web_sitesi_2.git
cd web_sitesi_2
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:

```env
PORT=5001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
PATIENT_INDEX=patients

# AI APIs
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
BRAVE_SEARCH_API_KEY=your_brave_search_key
CONSENSUS_API_KEY=your_consensus_key
```

Export frontend build args:

```bash
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

### 2. Run

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5001/api/health |
| Elasticsearch | http://localhost:9200 |

### 3. Index patient data

Once Elasticsearch is healthy:

```bash
python elastic_search_index/index_picu.py
```

### 4. Stop

```bash
docker compose down        # keep data
docker compose down -v     # remove data volumes
```

## Local Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5001

## API Reference

```
GET  /api/health
     /api/academic/*       Academic search routes
     /api/auth/*           Authentication
     /api/library/*        Library management
     /api/academic-lab/*   Academic lab agents
     /api/*                Project routes
```

## Environment Files

| File | Purpose |
|---|---|
| `backend/.env.example` | Backend environment template |
| `frontend/.env.example` | Frontend build args template |

Never commit `.env` files. They are excluded via `.gitignore`.
