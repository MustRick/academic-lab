-- ============================================================
-- PICUVision Academic Lab — Supabase Migration
-- Supabase SQL Editor'a yapıştır ve RUN et
-- ============================================================

-- ── 1. profiles — auth.users'ı extend eder ──────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT,
  institution   TEXT,
  specialty     TEXT,          -- 'PICU', 'Pediatri', vb.
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auth'da yeni kullanıcı oluşunca otomatik profil yarat
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, institution)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'institution'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. projects — araştırma projeleri ───────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  study_type    TEXT DEFAULT 'retrospektif',   -- rct, prospektif, vb.
  status        TEXT DEFAULT 'active',          -- active, completed, archived
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 3. research_outputs — tüm agent çıktıları tek tablo ─────
-- type: 'patient_scan' | 'literature' | 'dataset' | 'statistics'
--       'figures' | 'manuscript' | 'reviewer'
CREATE TABLE IF NOT EXISTS public.research_outputs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,           -- kullanıcının verdiği isim
  query         TEXT,                    -- ne aradığını hatırlatmak için
  payload       JSONB NOT NULL DEFAULT '{}',  -- agent input
  result        JSONB NOT NULL DEFAULT '{}',  -- agent output (tam)
  summary       TEXT,                    -- kısa özet (select box'ta görünür)
  tags          TEXT[] DEFAULT '{}',
  is_pinned     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. dataset_rows — DataEntry satırları ayrı tutulur ──────
-- (JSONB array yerine satır bazlı — büyük veri setleri için)
CREATE TABLE IF NOT EXISTS public.dataset_rows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  output_id     UUID NOT NULL REFERENCES public.research_outputs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  row_index     INTEGER NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. updated_at otomatik güncelleme trigger'ları ───────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.research_outputs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_outputs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6. Row Level Security (RLS) — kullanıcı sadece kendi verisini görür ──
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_outputs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_rows      ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Kendi profilini gör"    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Kendi profilini güncelle" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- projects
CREATE POLICY "Kendi projelerini gör"      ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Proje oluştur"              ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kendi projesini güncelle"   ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Kendi projesini sil"        ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- research_outputs
CREATE POLICY "Kendi çıktılarını gör"      ON public.research_outputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Çıktı kaydet"               ON public.research_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kendi çıktısını güncelle"   ON public.research_outputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Kendi çıktısını sil"        ON public.research_outputs FOR DELETE USING (auth.uid() = user_id);

-- dataset_rows
CREATE POLICY "Kendi satırlarını gör"      ON public.dataset_rows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Satır ekle"                 ON public.dataset_rows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kendi satırını güncelle"    ON public.dataset_rows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Kendi satırını sil"         ON public.dataset_rows FOR DELETE USING (auth.uid() = user_id);

-- ── 7. Index'ler — sık kullanılan sorgular için ──────────────
CREATE INDEX IF NOT EXISTS idx_research_outputs_user_type
  ON public.research_outputs(user_id, type);

CREATE INDEX IF NOT EXISTS idx_research_outputs_project
  ON public.research_outputs(project_id);

CREATE INDEX IF NOT EXISTS idx_dataset_rows_output
  ON public.dataset_rows(output_id, row_index);

-- ── 8. Kontrol sorgusu ───────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
