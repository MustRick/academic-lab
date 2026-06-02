-- ============================================================
-- PICUVision Academic Lab — Academic Writing Sessions Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academic_writing_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  active_agent  TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',
  state         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_writing_sessions_status_check
    CHECK (status IN (
      'draft',
      'collecting_input',
      'running',
      'ready_for_review',
      'changes_requested',
      'approved',
      'finalized',
      'error'
    ))
);

CREATE TABLE IF NOT EXISTS public.academic_writing_session_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.academic_writing_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name  TEXT,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.academic_writing_sessions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.academic_writing_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.academic_writing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_writing_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kendi akademik yazım oturumlarını gör"
  ON public.academic_writing_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Akademik yazım oturumu oluştur"
  ON public.academic_writing_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kendi akademik yazım oturumunu güncelle"
  ON public.academic_writing_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kendi akademik yazım oturumunu sil"
  ON public.academic_writing_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Kendi akademik yazım eventlerini gör"
  ON public.academic_writing_session_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Akademik yazım eventi oluştur"
  ON public.academic_writing_session_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kendi akademik yazım eventini güncelle"
  ON public.academic_writing_session_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kendi akademik yazım eventini sil"
  ON public.academic_writing_session_events FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_academic_writing_sessions_user
  ON public.academic_writing_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_academic_writing_sessions_project
  ON public.academic_writing_sessions(project_id);

CREATE INDEX IF NOT EXISTS idx_academic_writing_events_session
  ON public.academic_writing_session_events(session_id, created_at);
