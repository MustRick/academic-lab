import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] .env dosyasında VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY eksik.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pv_session'
  }
})

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password, { name, institution }) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { name, institution },
      emailRedirectTo: `${window.location.origin}/app/dashboard`
    }
  })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/app/dashboard` }
  })
  if (error) throw error
  return data
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function mapSupabaseUser(user) {
  if (!user) return null
  const m = user.user_metadata || {}
  return {
    id:          user.id,
    email:       user.email,
    name:        m.name || m.full_name || m.username || user.email?.split('@')[0] || 'Kullanıcı',
    institution: m.institution || m.organization || '',
    avatar:      m.avatar_url || null,
    createdAt:   user.created_at
  }
}
