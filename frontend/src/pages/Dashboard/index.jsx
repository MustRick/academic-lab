import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'

const AGENTS = [
  { to: '/app/patient-scan',    icon: 'ti-user-search',   color: 'bg-brand-50 text-brand-600',   name: 'Hasta Tarama',    desc: 'Elasticsearch kohort tarama' },
  { to: '/app/academic-search', icon: 'ti-search',        color: 'bg-blue-50 text-blue-700',     name: 'Literatür',       desc: 'Consensus MCP ile Q1-Q4' },
  { to: '/app/data',            icon: 'ti-table',         color: 'bg-green-50 text-green-700',   name: 'Veri Girişi',     desc: 'Excel import veya manuel' },
  { to: '/app/statistics',      icon: 'ti-chart-bar',     color: 'bg-purple-50 text-purple-700', name: 'İstatistik',      desc: 'Otomatik test seçimi' },
  { to: '/app/figures',         icon: 'ti-chart-dots',    color: 'bg-amber-50 text-amber-700',   name: 'Figürler',        desc: 'Publication-ready görseller' },
  { to: '/app/writing',         icon: 'ti-pencil',        color: 'bg-pink-50 text-pink-700',     name: 'Yazım',           desc: 'IMRaD manuscript taslağı' },
  { to: '/app/reviewer',        icon: 'ti-message-check', color: 'bg-teal-50 text-teal-700',     name: 'Reviewer Yanıtı', desc: 'Editör mailine yanıt' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900 tracking-tight">Laboratuvar</h1>
          <p className="text-sm text-gray-400 mt-0.5">Hoş geldin, {user?.name || 'Dr. Kullanıcı'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate('/app/academic-search')}>
            <i className="ti ti-search text-sm" />Literatür Tara
          </button>
          <button className="btn-primary" onClick={() => navigate('/app/data')}>
            <i className="ti ti-plus text-sm" />Yeni Proje
          </button>
        </div>
      </div>
      <div className="card">
        <div className="section-title mb-4">AI Agent Araçları</div>
        <div className="grid grid-cols-4 gap-3">
          {AGENTS.map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className="p-3 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/30 text-left transition-all group">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${a.color} group-hover:scale-110 transition-transform`}>
                <i className={`ti ${a.icon} text-base`} />
              </div>
              <div className="text-xs font-medium text-gray-800 mb-1">{a.name}</div>
              <div className="text-[11px] text-gray-400 leading-snug">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
