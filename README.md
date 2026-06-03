# Hasta Arama Sistemi

Hasta takibi ve akademik araştırma için tam yığın web uygulaması. React frontend, Express.js backend ve Elasticsearch üzerine inşa edilmiştir.

## Servisler

| Servis | Port | Açıklama |
|---|---|---|
| Frontend | http://localhost:3000 | React + Vite + Nginx |
| Backend | http://localhost:5001 | Express.js API |
| Elasticsearch | http://localhost:9200 | Arama motoru |

## Sayfalar

- **Dashboard** — Genel bakış
- **PatientScan** — Hasta tarama
- **AcademicSearch** — Akademik makale arama
- **Library** — Kişisel kütüphane
- **Projects** — Proje yönetimi
- **Records** — Kayıtlar
- **DataEntry / Statistics / Figures / Tables** — Veri girişi ve analiz
- **Writing / Reviewer** — Akademik yazım araçları

## Docker ile Çalıştırma

### 1. Ortam Değişkenlerini Ayarla

```bash
cp backend/.env.example backend/.env
```

`backend/.env` dosyasını düzenle:

```env
PORT=5001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
PATIENT_INDEX=patients

# AI APIs
OPENAI_API_KEY=your-openai-key
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
CONSENSUS_API_KEY=your-consensus-key
```

Frontend Supabase anahtarlarını build argümanı olarak geçir (`.env` veya shell export ile):

```bash
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Başlat

```bash
docker compose up -d --build
```

Tüm servisler hazır olduğunda:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api/health
- Elasticsearch: http://localhost:9200

### 3. Durdur

```bash
docker compose down
```

Elasticsearch verilerini de silmek için:

```bash
docker compose down -v
```

## Elasticsearch İndeksi

Elasticsearch ayağa kalktıktan sonra PICU indeksini oluşturmak için:

```bash
python elastic_search_index/index_picu.py
```

## Yerel Geliştirme (Docker olmadan)

### Gereksinimler

- Node.js 20+
- Çalışan bir Elasticsearch instance (localhost:9200)

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5001

## API Rotaları

```
GET  /api/health
     /api/academic/*
     /api/auth/*
     /api/library/*
     /api/academic-lab/*
     /api/*  (proje rotaları)
```
