import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, signOut, mapSupabaseUser } from '@/lib/supabase'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      session: null,
      status: 'loading',
      setSession: (session) => {
        if (session) {
          localStorage.setItem('pv_token', session.access_token)
          set({ session, user: mapSupabaseUser(session.user), status: 'authenticated' })
        } else {
          localStorage.removeItem('pv_token')
          set({ session: null, user: null, status: 'unauthenticated' })
        }
      },
      updateProfile: (updates) => set(s => ({ user: s.user ? { ...s.user, ...updates } : s.user })),
      logout: async () => {
        try { await signOut() } catch (_) {}
        localStorage.removeItem('pv_token')
        set({ user: null, session: null, status: 'unauthenticated' })
      }
    }),
    { name: 'pv_auth', partialize: s => ({ user: s.user }) }
  )
)

// ── Data (DataEntry ↔ Statistics shared) ─────────────────────────────────────
export const useDataStore = create((set) => ({
  schema: null,
  setSchema: (schema) => set({ schema }),
  updateCell: (rowIdx, colKey, value) =>
    set(s => {
      if (!s.schema) return s
      const rows = s.schema.rows.map((r, i) => i === rowIdx ? { ...r, [colKey]: value } : r)
      return { schema: { ...s.schema, rows } }
    }),
  addRow: () =>
    set(s => {
      if (!s.schema) return s
      const empty = Object.fromEntries(s.schema.columns.map(c => [c.key, null]))
      return { schema: { ...s.schema, rows: [...s.schema.rows, empty] } }
    }),
  deleteRow: (idx) =>
    set(s => s.schema ? { schema: { ...s.schema, rows: s.schema.rows.filter((_, i) => i !== idx) } } : s),
  addColumn: (col) =>
    set(s => {
      if (!s.schema) return s
      return { schema: { ...s.schema, columns: [...s.schema.columns, col], rows: s.schema.rows.map(r => ({ ...r, [col.key]: null })) } }
    }),
  reset: () => set({ schema: null })
}))

// ── Statistics ────────────────────────────────────────────────────────────────
export const useStatsStore = create((set) => ({
  recommendation: null,
  normalityResults: null,
  approvedTests: [],
  results: null,
  status: 'idle',
  setRecommendation: (rec, norm) => set({ recommendation: rec, normalityResults: norm, status: 'awaiting', approvedTests: rec?.tests?.map(t => t.testName) || [] }),
  toggleTest: (name) => set(s => ({ approvedTests: s.approvedTests.includes(name) ? s.approvedTests.filter(t => t !== name) : [...s.approvedTests, name] })),
  setResults: (r) => set({ results: r, status: 'done' }),
  setStatus: (s) => set({ status: s }),
  reset: () => set({ recommendation: null, normalityResults: null, approvedTests: [], results: null, status: 'idle' })
}))

// ── Figures ───────────────────────────────────────────────────────────────────
export const useFiguresStore = create((set) => ({
  figures: null, status: 'idle',
  setFigures: (f) => set({ figures: f, status: 'done' }),
  setStatus: (s) => set({ status: s }),
  reset: () => set({ figures: null, status: 'idle' })
}))
