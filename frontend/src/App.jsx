import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import Login, { Register } from '@/pages/Login'
import Dashboard            from '@/pages/Dashboard'
import PatientScan          from '@/pages/PatientScan'
import AcademicSearch       from '@/pages/AcademicSearch'
import Library              from '@/pages/Library'
import Projects             from '@/pages/Projects'
import DataEntry            from '@/pages/DataEntry'
import Statistics           from '@/pages/Statistics'
import Figures              from '@/pages/Figures'
import Tables               from '@/pages/Tables'
import Writing              from '@/pages/Writing'
import Reviewer             from '@/pages/Reviewer'
import Records              from '@/pages/Records'

function AuthProvider({ children }) {
  const { setSession, status } = useAuthStore()

  useEffect(() => {
    // Sayfa açılışında mevcut session'ı al
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    // Sonraki auth değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold font-display">P</span>
          </div>
          <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }
  return children
}

function RequireAuth({ children }) {
  const { status } = useAuthStore()
  if (status === 'loading') return null
  return status === 'authenticated' ? children : <Navigate to="/login" replace />
}

function PublicOnly({ children }) {
  const { status } = useAuthStore()
  if (status === 'loading') return null
  return status === 'authenticated' ? <Navigate to="/app/dashboard" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: { fontFamily: 'DM Sans, sans-serif', fontSize: 13, borderRadius: 10, border: '0.5px solid #E7E8EC', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
          success: { iconTheme: { primary: '#21B66F', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#E24B4A', secondary: '#fff' } },
        }} />
        <Routes>
          <Route path="/login"    element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index                  element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"       element={<Dashboard />} />
            <Route path="patient-scan"    element={<PatientScan />} />
            <Route path="academic-search" element={<AcademicSearch />} />
            <Route path="library"         element={<Library />} />
            <Route path="projects"        element={<Projects />} />
            <Route path="projects/:projectId" element={<Projects />} />
            <Route path="data"            element={<DataEntry />} />
            <Route path="statistics"      element={<Statistics />} />
            <Route path="figures"         element={<Figures />} />
            <Route path="tables"          element={<Tables />} />
            <Route path="writing"         element={<Writing />} />
            <Route path="reviewer"        element={<Reviewer />} />
            <Route path="records"         element={<Records />} />
          </Route>
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
