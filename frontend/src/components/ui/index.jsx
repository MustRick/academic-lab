export function Spinner({ size = 'md', className = '' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'
  return <div className={`${s} border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin ${className}`} />
}

export function AgentRunning({ message = 'Agent çalışıyor...' }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
      <Spinner size="sm" />
      <span className="text-sm text-amber-700 font-medium">{message}</span>
    </div>
  )
}

export function EmptyState({ icon = 'ti-inbox', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <i className={`ti ${icon} text-gray-400 text-xl`} />
      </div>
      <h3 className="text-sm font-medium text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  )
}

export function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <i className={`ti ${icon} text-brand-600 text-lg`} />
          </div>
        )}
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function ResultCard({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="section-title mb-4">{title}</div>}
      {children}
    </div>
  )
}

export function StatBox({ label, value, sub, color = 'brand' }) {
  const colors = { brand: 'bg-brand-50 text-brand-600', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-700' }
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-medium inline-block px-2 py-0.5 rounded-lg ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export function PValueBadge({ p }) {
  const num = parseFloat(p)
  if (isNaN(num)) return <span className="text-gray-400 text-xs">—</span>
  const cls = num < 0.001 ? 'bg-green-50 text-green-700' : num < 0.05 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
  const label = num < 0.001 ? '<0.001' : `${num.toFixed(3)}${num < 0.05 ? ' *' : ''}`
  return <span className={`badge ${cls}`}>p = {label}</span>
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-900">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><i className="ti ti-x text-sm" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
