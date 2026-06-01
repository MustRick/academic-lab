import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Google OAuth aktif etmek için:
// Supabase Dashboard → Authentication → Sign In / Providers → Google → Enable
// Sonra burayı true yap
const GOOGLE_ENABLED = false

// ── Rate limit (frontend tarafı) ─────────────────────────────────────────────
let attempts = 0, lastAttempt = 0
const MAX = 3, COOLDOWN = 60_000

function checkRate() {
  const now = Date.now()
  if (now - lastAttempt > COOLDOWN) attempts = 0
  if (attempts >= MAX) {
    const wait = Math.ceil((COOLDOWN - (now - lastAttempt)) / 1000)
    throw new Error(`rate:${wait}`)
  }
  attempts++; lastAttempt = now
}

// ── Hata çevirisi ─────────────────────────────────────────────────────────────
function tr(err) {
  const m = err?.message || ''
  if (m.startsWith('rate:'))                          return `Çok fazla deneme. ${m.split(':')[1]} saniye bekleyin.`
  if (m.includes('over_email_send_rate_limit') ||
      m.includes('rate limit') || m.includes('too many')) return 'Çok fazla istek. 1 dakika bekleyip tekrar deneyin.'
  if (m.includes('Invalid login credentials'))        return 'E-posta veya şifre hatalı.'
  if (m.includes('Email not confirmed'))              return 'Hesabınız henüz onaylanmadı. Yönetici onayı bekleniyor.'
  if (m.includes('User already registered'))          return 'Bu e-posta zaten kayıtlı. Giriş yapın.'
  if (m.includes('Password should be at least'))      return 'Şifre en az 6 karakter olmalı.'
  if (m.includes('Unable to validate email'))         return 'Geçersiz e-posta adresi.'
  if (m.includes('provider is not enabled'))          return 'Google girişi henüz aktif değil. E-posta ile giriş yapın.'
  if (m.includes('network') || m.includes('fetch'))  return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
  return m || 'Bir hata oluştu.'
}

// ── Shared bileşenler ─────────────────────────────────────────────────────────
function Brand() {
  return (
    <div className="text-center mb-8">
      <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
        <span className="text-white text-xl font-bold font-display">P</span>
      </div>
      <h1 className="font-display text-2xl font-semibold text-gray-900">PICUVision</h1>
      <p className="text-sm text-gray-400 mt-1">Academic Lab</p>
    </div>
  )
}

function Divider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
      <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">veya</span></div>
    </div>
  )
}

function SubmitBtn({ loading, label }) {
  return (
    <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
      {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{label}...</> : label}
    </button>
  )
}

function Countdown({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) { onDone?.(); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return (
    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-4">
      <i className="ti ti-clock" />
      <span>Çok fazla deneme. <b>{left} saniye</b> bekleyin.</span>
    </div>
  )
}

function GoogleNote() {
  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start gap-2 text-xs text-gray-500">
        <i className="ti ti-info-circle mt-0.5 flex-shrink-0" />
        <span>Google girişi şu an devre dışı. E-posta ve şifre ile devam edin.</span>
      </div>
    </div>
  )
}

function GoogleBtn({ disabled }) {
  const handleGoogle = async () => {
    if (!GOOGLE_ENABLED) { toast.error('Google girişi henüz aktif değil.'); return }
    try { await signInWithGoogle() } catch (e) { toast.error(tr(e)) }
  }
  return (
    <>
      <Divider />
      <button type="button" onClick={handleGoogle} disabled={disabled}
        className="w-full flex items-center justify-center gap-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        Google ile devam et
      </button>
    </>
  )
}

// ── GİRİŞ FORMU ──────────────────────────────────────────────────────────────
function LoginForm() {
  const navigate = useNavigate()
  const { setSession } = useAuthStore()
  const [loading, setLoading]   = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [form, setForm]         = useState({ email: '', password: '' })

  const F = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cooldown > 0) return
    setLoading(true)
    try {
      checkRate()
      const { session } = await signInWithEmail(form.email, form.password)
      attempts = 0
      setSession(session)
      toast.success('Hoş geldiniz!')
      navigate('/app/dashboard')
    } catch (err) {
      const msg = tr(err)
      if (msg.includes('bekleyin')) setCooldown(60)
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const handleForgot = async () => {
    if (!form.email) { toast.error('Önce e-posta girin.'); return }
    try { await resetPassword(form.email); toast.success('Şifre sıfırlama maili gönderildi.') }
    catch (e) { toast.error(tr(e)) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      <h2 className="text-base font-medium text-gray-800 mb-6">Hesabınıza giriş yapın</h2>
      {cooldown > 0 && <Countdown seconds={cooldown} onDone={() => setCooldown(0)} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">E-posta</label>
          <input type="email" className="input" required value={form.email} onChange={F('email')}
            placeholder="doktor@kurum.edu.tr" autoComplete="email" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Şifre</label>
            <button type="button" onClick={handleForgot} className="text-xs text-brand-600 hover:text-brand-800">Şifremi unuttum</button>
          </div>
          <input type="password" className="input" required value={form.password} onChange={F('password')}
            placeholder="••••••••" autoComplete="current-password" />
        </div>
        <SubmitBtn loading={loading || cooldown > 0} label="Giriş Yap" />
      </form>
      {GOOGLE_ENABLED ? <GoogleBtn disabled={loading} /> : <GoogleNote />}
      <p className="text-center text-xs text-gray-400 mt-6">
        Hesabınız yok mu? <Link to="/register" className="text-brand-600 hover:text-brand-800 font-medium">Kayıt olun</Link>
      </p>
    </div>
  )
}

// ── KAYIT FORMU ───────────────────────────────────────────────────────────────
function RegisterForm() {
  const { setSession } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading]     = useState(false)
  const [cooldown, setCooldown]   = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', institution: '', email: '', password: '', confirm: '' })

  const F = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const pwMatch = !form.confirm || form.password === form.confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cooldown > 0) return
    if (!pwMatch) { toast.error('Şifreler eşleşmiyor.'); return }
    if (form.password.length < 6) { toast.error('Şifre en az 6 karakter olmalı.'); return }
    setLoading(true)
    try {
      checkRate()
      const { session } = await signUpWithEmail(form.email, form.password, { name: form.name, institution: form.institution })
      attempts = 0
      if (session) {
        // Email doğrulaması kapalıysa direkt giriş
        setSession(session)
        toast.success('Kayıt başarılı! Hoş geldiniz.')
        navigate('/app/dashboard')
      } else {
        // Manuel onay bekleniyor
        setSubmitted(true)
      }
    } catch (err) {
      const msg = tr(err)
      if (msg.includes('bekleyin')) setCooldown(60)
      toast.error(msg)
    } finally { setLoading(false) }
  }

  // ── Manuel onay bekleme ekranı ────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-clock-hour-4 text-brand-600 text-2xl" />
        </div>
        <h2 className="text-base font-medium text-gray-800 mb-2">Hesabınız incelemede</h2>
        <p className="text-sm text-gray-500 mb-2 leading-relaxed">
          <strong className="text-gray-700">{form.email}</strong> adresiyle kaydınız alındı.
        </p>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Hesabınız yönetici onayından geçtikten sonra giriş yapabileceksiniz.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <div className="text-xs font-medium text-gray-600 mb-2">Kayıt bilgileri</div>
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Ad Soyad</span><span className="font-medium text-gray-700">{form.name}</span>
            </div>
            {form.institution && (
              <div className="flex justify-between">
                <span>Kurum</span><span className="font-medium text-gray-700">{form.institution}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>E-posta</span><span className="font-medium text-gray-700">{form.email}</span>
            </div>
          </div>
        </div>
        <Link to="/login" className="btn-secondary inline-flex justify-center">Giriş sayfasına dön</Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      <h2 className="text-base font-medium text-gray-800 mb-6">Yeni hesap oluşturun</h2>
      {cooldown > 0 && <Countdown seconds={cooldown} onDone={() => setCooldown(0)} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ad Soyad *</label>
            <input className="input" required value={form.name} onChange={F('name')} placeholder="Dr. Ali Yılmaz" autoComplete="name" />
          </div>
          <div>
            <label className="label">Kurum</label>
            <input className="input" value={form.institution} onChange={F('institution')} placeholder="Çukurova Üni." />
          </div>
        </div>
        <div>
          <label className="label">E-posta *</label>
          <input type="email" className="input" required value={form.email} onChange={F('email')} placeholder="doktor@kurum.edu.tr" autoComplete="email" />
        </div>
        <div>
          <label className="label">Şifre * <span className="text-gray-400 font-normal">(en az 6 karakter)</span></label>
          <input type="password" className="input" required minLength={6} value={form.password} onChange={F('password')} placeholder="••••••••" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Şifre tekrar *</label>
          <input type="password" className="input" required value={form.confirm} onChange={F('confirm')} placeholder="••••••••"
            style={!pwMatch ? { borderColor: '#E24B4A' } : {}} autoComplete="new-password" />
          {!pwMatch && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" />Şifreler eşleşmiyor</p>}
        </div>
        <SubmitBtn loading={loading || cooldown > 0} label="Kayıt Ol" />
      </form>
      {GOOGLE_ENABLED ? <GoogleBtn disabled={loading} /> : <GoogleNote />}
      <p className="text-center text-xs text-gray-400 mt-6">
        Zaten hesabınız var mı? <Link to="/login" className="text-brand-600 hover:text-brand-800 font-medium">Giriş yapın</Link>
      </p>
    </div>
  )
}

// ── SAYFA EXPORT'LARI ─────────────────────────────────────────────────────────
export default function Login() {
  const { setSession } = useAuthStore()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        setSession(session)
        navigate('/app/dashboard', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (searchParams.get('type') === 'recovery') navigate('/auth/reset-password')
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Brand />
        <LoginForm />
        <p className="text-center text-xs text-gray-400 mt-6">Akademik araştırma için güvenli ortam · Verileriniz şifrelenir</p>
      </div>
    </div>
  )
}

export function Register() {
  const { setSession } = useAuthStore()
  const navigate       = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSession(session)
        navigate('/app/dashboard', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Brand />
        <RegisterForm />
        <p className="text-center text-xs text-gray-400 mt-6">Akademik araştırma için güvenli ortam · Verileriniz şifrelenir</p>
      </div>
    </div>
  )
}
