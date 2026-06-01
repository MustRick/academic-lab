import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store'

const NAV = [
  { to: '/app/dashboard',        icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { to: '/app/patient-scan',     icon: 'ti-user-search',      label: 'Hasta Tarama' },
  { to: '/app/academic-search',  icon: 'ti-search',           label: 'Literatür' },
  { to: '/app/data',             icon: 'ti-table',            label: 'Veri Girişi' },
  { to: '/app/statistics',       icon: 'ti-chart-bar',        label: 'İstatistik' },
  { to: '/app/figures',          icon: 'ti-chart-dots',       label: 'Figürler' },
  { to: '/app/writing',          icon: 'ti-pencil',           label: 'Yazım' },
  { to: '/app/reviewer',         icon: 'ti-message-check',    label: 'Reviewer' },
]

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="flex flex-col bg-white border-r border-gray-100 transition-all duration-200 flex-shrink-0"
        style={{ width: collapsed ? 64 : 220 }}>

        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          {!collapsed && (
            <div>
              <div className="font-display text-base font-semibold text-gray-900 leading-none">PICUVision</div>
              <div className="text-[10px] text-gray-400 tracking-wide uppercase mt-0.5">Academic Lab</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {!collapsed && <div className="px-2 pb-1 pt-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Workflow</div>}
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`
              }>
              <i className={`ti ${item.icon} text-base flex-shrink-0`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-2">
          <button onClick={() => setCollapsed(c => !c)} className="btn-ghost w-full justify-center mb-1">
            <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`} />
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{user?.name || 'Kullanıcı'}</div>
                <div className="text-[10px] text-gray-400 truncate">{user?.institution || 'PICU'}</div>
              </div>
              <button onClick={() => { logout(); navigate('/login') }}
                className="opacity-0 group-hover:opacity-100 transition-opacity" title="Çıkış">
                <i className="ti ti-logout text-gray-400 text-sm" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto"><Outlet /></main>
    </div>
  )
}
