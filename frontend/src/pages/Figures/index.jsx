import { useEffect, useMemo, useRef, useState } from 'react'
import { figuresAPI } from '@/api'
import { PageHeader, EmptyState, StatBox } from '@/components/ui'
import { SaveBar, SavedBadge } from '@/components/ui/SaveBar'
import { OUTPUT_TYPES, getOutput, listOutputs, loadDatasetRows } from '@/lib/outputs'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, ErrorBar, Label, Legend,
  Line, LineChart, ResponsiveContainer, Scatter,
  Tooltip, XAxis, YAxis
} from 'recharts'
import toast from 'react-hot-toast'

const COLORS = ['#534AB7', '#1D9E75', '#378ADD', '#BA7517', '#D4537E', '#E24B4A', '#639922', '#0891b2']
const OLD_FORMAT_WARNING = 'Bu kayıt eski formatta oluşturulmuş. Figür oluşturmak için İstatistik sayfasında analizi yeniden çalıştırıp kaydedin.'

function pValue(result) {
  return result?.pValue ?? result?.p_value ?? result?.p ?? null
}

function pLabel(p) {
  const n = Number(p)
  if (!Number.isFinite(n)) return 'p = —'
  return n < 0.001 ? 'p < 0.001' : `p = ${n.toFixed(3)}`
}

function columnLabel(schema, key) {
  return schema?.columns?.find(c => c.key === key)?.label || key || '—'
}

function numericRows(rows, xKey, yKey) {
  return rows.map(row => ({ x: Number(row[xKey]), y: Number(row[yKey]) }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
}

function calcStats(values) {
  const nums = values.map(Number).filter(Number.isFinite)
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const n = nums.length
  const mean = nums.reduce((sum, value) => sum + value, 0) / n
  const sd = Math.sqrt(nums.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(n - 1, 1))
  const q = pct => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * pct))]
  return {
    n,
    mean,
    sd,
    min: sorted[0],
    q1: q(0.25),
    med: q(0.5),
    q3: q(0.75),
    max: sorted[sorted.length - 1]
  }
}

function groupedStats(rows, groupKey, outcomeKey) {
  const groups = [...new Set(rows.map(row => row[groupKey]).filter(v => v !== null && v !== undefined && v !== '').map(String))]
  return groups.map(group => {
    const vals = rows.filter(row => String(row[groupKey]) === group).map(row => row[outcomeKey])
    const stats = calcStats(vals)
    return stats ? { label: group, ...stats } : null
  }).filter(Boolean)
}

function linearTrend(points) {
  if (points.length < 2) return []
  const n = points.length
  const sx = points.reduce((sum, p) => sum + p.x, 0)
  const sy = points.reduce((sum, p) => sum + p.y, 0)
  const sxy = points.reduce((sum, p) => sum + p.x * p.y, 0)
  const sx2 = points.reduce((sum, p) => sum + p.x * p.x, 0)
  const denom = n * sx2 - sx * sx
  if (!denom) return []
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  return [{ x: minX, trend: slope * minX + intercept }, { x: maxX, trend: slope * maxX + intercept }]
}

function BoxPlotChart({ data }) {
  const values = data.flatMap(d => [d.min, d.max])
  const globalMin = Math.min(...values)
  const globalMax = Math.max(...values)
  const range = globalMax - globalMin || 1
  const toY = value => 190 - ((value - globalMin) / range) * 160

  return (
    <div className="h-[260px] flex items-center justify-center">
      <svg width="100%" height="240" viewBox="0 0 520 240" role="img">
        <line x1="40" y1="190" x2="500" y2="190" stroke="#e5e7eb" />
        <line x1="40" y1="30" x2="40" y2="190" stroke="#e5e7eb" />
        {data.map((d, i) => {
          const x = 90 + i * (420 / Math.max(data.length, 1))
          const color = COLORS[i % COLORS.length]
          return (
            <g key={d.label}>
              <line x1={x} y1={toY(d.max)} x2={x} y2={toY(d.q3)} stroke={color} strokeWidth="2" />
              <line x1={x} y1={toY(d.q1)} x2={x} y2={toY(d.min)} stroke={color} strokeWidth="2" />
              <line x1={x - 16} y1={toY(d.max)} x2={x + 16} y2={toY(d.max)} stroke={color} strokeWidth="2" />
              <line x1={x - 16} y1={toY(d.min)} x2={x + 16} y2={toY(d.min)} stroke={color} strokeWidth="2" />
              <rect x={x - 26} y={toY(d.q3)} width="52" height={Math.max(3, toY(d.q1) - toY(d.q3))} fill={`${color}30`} stroke={color} strokeWidth="2" />
              <line x1={x - 26} y1={toY(d.med)} x2={x + 26} y2={toY(d.med)} stroke={color} strokeWidth="3" />
              <circle cx={x} cy={toY(d.mean)} r="4" fill={color} />
              <text x={x} y="216" textAnchor="middle" fontSize="11" fill="#374151">{d.label}</text>
              <text x={x} y="231" textAnchor="middle" fontSize="10" fill="#9ca3af">n={d.n}</text>
            </g>
          )
        })}
        <text x="16" y="34" fontSize="10" fill="#9ca3af">{globalMax.toFixed(1)}</text>
        <text x="16" y="192" fontSize="10" fill="#9ca3af">{globalMin.toFixed(1)}</text>
      </svg>
    </div>
  )
}

function ViolinPlot({ data, rows, groupKey, outcomeKey }) {
  const maxN = Math.max(...data.map(d => d.n), 1)
  return (
    <div className="h-[260px] flex items-center justify-center">
      <svg width="100%" height="240" viewBox="0 0 520 240" role="img">
        <line x1="40" y1="190" x2="500" y2="190" stroke="#e5e7eb" />
        {data.map((d, i) => {
          const x = 90 + i * (420 / Math.max(data.length, 1))
          const color = COLORS[i % COLORS.length]
          const width = 18 + (d.n / maxN) * 34
          const vals = rows.filter(row => String(row[groupKey]) === d.label).map(row => Number(row[outcomeKey])).filter(Number.isFinite)
          const jitter = vals.slice(0, 80)
          const globalMin = Math.min(...data.map(g => g.min))
          const globalMax = Math.max(...data.map(g => g.max))
          const toY = value => 190 - ((value - globalMin) / (globalMax - globalMin || 1)) * 160
          return (
            <g key={d.label}>
              <path
                d={`M ${x} 34 C ${x - width} 58, ${x - width} 162, ${x} 186 C ${x + width} 162, ${x + width} 58, ${x} 34 Z`}
                fill={`${color}25`}
                stroke={color}
                strokeWidth="2"
              />
              <line x1={x - width * 0.55} y1={toY(d.med)} x2={x + width * 0.55} y2={toY(d.med)} stroke={color} strokeWidth="3" />
              {jitter.map((value, pi) => (
                <circle key={pi} cx={x + ((pi % 9) - 4) * 2.5} cy={toY(value)} r="1.5" fill={color} opacity="0.45" />
              ))}
              <text x={x} y="216" textAnchor="middle" fontSize="11" fill="#374151">{d.label}</text>
              <text x={x} y="231" textAnchor="middle" fontSize="10" fill="#9ca3af">n={d.n}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function MeanBarChart({ data, yLabel }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 24, right: 20, bottom: 12, left: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }}>
          <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#9ca3af' }} />
        </YAxis>
        <Tooltip formatter={value => Number(value).toFixed(3)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          <ErrorBar dataKey="sd" width={8} strokeWidth={2} stroke="#374151" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ScatterPlot({ data, trend, xLabel, yLabel }) {
  const trendByX = trend.length === 2
    ? data.map(point => {
        const [a, b] = trend
        const slope = (b.trend - a.trend) / ((b.x - a.x) || 1)
        return { ...point, trend: a.trend + slope * (point.x - a.x) }
      }).sort((a, b) => a.x - b.x)
    : data

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={trendByX} margin={{ top: 16, right: 20, bottom: 18, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 10 }}>
          <Label value={xLabel} offset={-10} position="insideBottom" style={{ fontSize: 10, fill: '#9ca3af' }} />
        </XAxis>
        <YAxis dataKey="y" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10 }}>
          <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#9ca3af' }} />
        </YAxis>
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Scatter dataKey="y" fill={COLORS[0]} fillOpacity={0.72} />
        <Line dataKey="trend" stroke={COLORS[3]} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function Histogram({ values, xLabel }) {
  const nums = values.map(Number).filter(Number.isFinite)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const bins = 8
  const bw = (max - min) / bins || 1
  const data = Array.from({ length: bins }, (_, i) => ({ label: (min + i * bw).toFixed(1), count: 0 }))
  nums.forEach(value => data[Math.min(bins - 1, Math.floor((value - min) / bw))].count++)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 16, right: 12, bottom: 18, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }}>
          <Label value={xLabel} offset={-10} position="insideBottom" style={{ fontSize: 10, fill: '#9ca3af' }} />
        </XAxis>
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="count" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function StackedBar({ rows, rowKey, colKey }) {
  const rowValues = [...new Set(rows.map(row => row[rowKey]).filter(Boolean).map(String))]
  const colValues = [...new Set(rows.map(row => row[colKey]).filter(Boolean).map(String))]
  const data = rowValues.map(rowValue => {
    const item = { label: rowValue }
    colValues.forEach(colValue => {
      item[colValue] = rows.filter(row => String(row[rowKey]) === rowValue && String(row[colKey]) === colValue).length
    })
    return item
  })
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 20, bottom: 12, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {colValues.map((value, i) => <Bar key={value} dataKey={value} stackId="a" fill={COLORS[i % COLORS.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map(col => <th key={col} className="text-left py-2 px-2 text-gray-500 font-medium">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50">
              {columns.map(col => <td key={col} className="py-2 px-2 text-gray-700">{row[col]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function crosstab(rows, schema, rowKey, colKey) {
  const rowLabel = columnLabel(schema, rowKey)
  const rowValues = [...new Set(rows.map(row => row[rowKey]).filter(Boolean).map(String))]
  const colValues = [...new Set(rows.map(row => row[colKey]).filter(Boolean).map(String))]
  return {
    columns: [rowLabel, ...colValues],
    rows: rowValues.map(rowValue => {
      const item = { [rowLabel]: rowValue }
      colValues.forEach(colValue => {
        item[colValue] = rows.filter(row => String(row[rowKey]) === rowValue && String(row[colKey]) === colValue).length
      })
      return item
    })
  }
}

function Table1({ rows, schema, variables }) {
  const cols = ['Değişken', 'Özet', 'Eksik']
  const tableRows = variables.map(key => {
    const column = schema.columns.find(c => c.key === key)
    const values = rows.map(row => row[key]).filter(value => value !== null && value !== undefined && value !== '')
    const missing = rows.length - values.length
    let summary = '—'
    if (column?.type === 'number') {
      const s = calcStats(values)
      if (s) summary = `${s.mean.toFixed(2)} ± ${s.sd.toFixed(2)}`
    } else if (values.length) {
      summary = [...new Set(values.map(String))].slice(0, 4).map(value => {
        const count = values.filter(item => String(item) === value).length
        return `${value}: ${count} (${((count / values.length) * 100).toFixed(1)}%)`
      }).join(', ')
    }
    return { Değişken: column?.label || key, Özet: summary, Eksik: missing }
  })
  return <SimpleTable columns={cols} rows={tableRows} />
}

function ForestPlot({ items, reference = 0 }) {
  const extents = items.flatMap(item => [item.low, item.high, reference]).filter(Number.isFinite)
  const min = Math.min(...extents)
  const max = Math.max(...extents)
  const toX = value => 80 + ((value - min) / (max - min || 1)) * 360
  return (
    <svg width="100%" height={Math.max(180, items.length * 42 + 70)} viewBox={`0 0 520 ${Math.max(180, items.length * 42 + 70)}`} role="img">
      <line x1={toX(reference)} y1="26" x2={toX(reference)} y2={items.length * 42 + 36} stroke="#d1d5db" strokeDasharray="4 3" />
      {items.map((item, i) => {
        const y = 50 + i * 42
        return (
          <g key={item.label}>
            <text x="18" y={y + 4} fontSize="11" fill="#374151">{item.label}</text>
            <line x1={toX(item.low)} y1={y} x2={toX(item.high)} y2={y} stroke={COLORS[0]} strokeWidth="2" />
            <circle cx={toX(item.estimate)} cy={y} r="5" fill={COLORS[0]} />
            <text x="450" y={y + 4} fontSize="10" fill="#6b7280">{item.estimate.toFixed(3)}</text>
          </g>
        )
      })}
      <line x1="80" y1={items.length * 42 + 45} x2="440" y2={items.length * 42 + 45} stroke="#e5e7eb" />
      <text x="80" y={items.length * 42 + 62} fontSize="10" fill="#9ca3af">{min.toFixed(2)}</text>
      <text x="420" y={items.length * 42 + 62} fontSize="10" fill="#9ca3af">{max.toFixed(2)}</text>
    </svg>
  )
}

function KaplanMeierChart({ rows, timeKey, eventKey, groupKey }) {
  const groups = groupKey ? [...new Set(rows.map(row => row[groupKey]).filter(Boolean).map(String))] : ['Tüm hastalar']
  const maxTime = Math.max(...rows.map(row => Number(row[timeKey])).filter(Number.isFinite), 1)
  const curveData = Array.from({ length: 16 }, (_, i) => {
    const time = (i / 15) * maxTime
    const item = { time: Number(time.toFixed(2)) }
    groups.forEach(group => {
      const groupRows = groupKey ? rows.filter(row => String(row[groupKey]) === group) : rows
      const events = groupRows.filter(row => Number(row[timeKey]) <= time && Number(row[eventKey]) === 1).length
      item[group] = Math.max(0, 1 - events / Math.max(groupRows.length, 1))
    })
    return item
  })
  const riskRows = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const time = maxTime * f
    const item = { Zaman: time.toFixed(1) }
    groups.forEach(group => {
      const groupRows = groupKey ? rows.filter(row => String(row[groupKey]) === group) : rows
      item[group] = groupRows.filter(row => Number(row[timeKey]) >= time).length
    })
    return item
  })
  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={curveData} margin={{ top: 16, right: 20, bottom: 16, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {groups.map((group, i) => <Line key={group} type="stepAfter" dataKey={group} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />)}
        </LineChart>
      </ResponsiveContainer>
      <div className="text-[10px] text-gray-400 mb-1">Risk table</div>
      <SimpleTable columns={['Zaman', ...groups]} rows={riskRows} />
    </div>
  )
}

function figureRequests(results) {
  return (results || []).flatMap((test, i) => {
    const c = test.columns || {}
    const base = { testName: test.testName, sourceIndex: i }
    if (['independent_t_test', 'paired_t_test'].includes(test.testName)) return [
      { ...base, kind: 'boxplot', mapping: { x: c.group, y: c.outcome } },
      { ...base, kind: 'mean_sd', mapping: { x: c.group, y: c.outcome } }
    ]
    if (test.testName === 'mann_whitney_u') return [
      { ...base, kind: 'boxplot', mapping: { x: c.group, y: c.outcome } },
      { ...base, kind: 'violin', mapping: { x: c.group, y: c.outcome } }
    ]
    if (['one_way_anova', 'anova'].includes(test.testName)) return [
      { ...base, kind: 'boxplot', mapping: { x: c.group, y: c.outcome } },
      { ...base, kind: 'mean_sd', mapping: { x: c.group, y: c.outcome } }
    ]
    if (test.testName === 'kruskal_wallis') return [
      { ...base, kind: 'violin', mapping: { x: c.group, y: c.outcome } },
      { ...base, kind: 'boxplot', mapping: { x: c.group, y: c.outcome } }
    ]
    if (['pearson_correlation', 'spearman_correlation'].includes(test.testName)) return [{ ...base, kind: 'scatter', mapping: { x: c.x, y: c.y } }]
    if (['chi_square', 'chi_square_test', 'fisher_exact', 'fisher_exact_test'].includes(test.testName)) return [
      { ...base, kind: 'stacked_bar', mapping: { row: c.row, col: c.col } },
      { ...base, kind: 'crosstab', mapping: { row: c.row, col: c.col } }
    ]
    if (test.testName === 'linear_regression') return [{ ...base, kind: 'coefficient_plot', mapping: c }]
    if (test.testName === 'logistic_regression') return [{ ...base, kind: 'or_forest', mapping: c }]
    if (test.testName === 'cox_regression') return [{ ...base, kind: 'hr_forest', mapping: c }]
    if (['kaplan_meier', 'log_rank_test'].includes(test.testName)) return [{ ...base, kind: 'kaplan_meier', mapping: { time: c.time, event: c.event, group: c.group } }]
    if (test.testName === 'descriptive_stats') return [
      { ...base, kind: 'histogram', mapping: { variable: c.outcome || c.variable } },
      { ...base, kind: 'table1', mapping: { variables: [c.outcome || c.variable].filter(Boolean) } }
    ]
    return []
  })
}

function buildFigures(statisticalResults, schema, rows) {
  const figures = []
  const counts = {}
  const add = (test, fig) => {
    counts[test.testName] = (counts[test.testName] || 0) + 1
    figures.push({ ...fig, sourceTest: test.testName, sourceDisplayName: test.displayName || test.testName })
  }

  statisticalResults.filter(r => r.status !== 'error').forEach((test, i) => {
    const res = test.result || {}
    const cols = test.columns || {}
    const p = pValue(res)

    if (['independent_t_test', 'mann_whitney_u', 'one_way_anova', 'anova', 'kruskal_wallis'].includes(test.testName)) {
      const groupKey = cols.group
      const outcomeKey = cols.outcome
      if (!groupKey || !outcomeKey) return
      const data = groupedStats(rows, groupKey, outcomeKey)
      const groupLabel = columnLabel(schema, groupKey)
      const outcomeLabel = columnLabel(schema, outcomeKey)
      if (!data.length) return
      const baseTitle = `${groupLabel} gruplarına göre ${outcomeLabel}`
      add(test, { id: `box_${i}`, type: 'box plot', title: `${baseTitle} - box plot`, subtitle: pLabel(p), component: <BoxPlotChart data={data} /> })
      if (test.testName === 'mann_whitney_u' || test.testName === 'kruskal_wallis') {
        add(test, { id: `violin_${i}`, type: 'violin plot', title: `${baseTitle} - violin plot`, subtitle: pLabel(p), component: <ViolinPlot data={data} rows={rows} groupKey={groupKey} outcomeKey={outcomeKey} /> })
      } else {
        add(test, { id: `mean_${i}`, type: 'ortalama +/- SD', title: `${baseTitle} - ortalama +/- SD`, subtitle: pLabel(p), component: <MeanBarChart data={data.map(d => ({ label: d.label, mean: d.mean, sd: d.sd }))} yLabel={outcomeLabel} /> })
      }
    }

    if (['pearson_correlation', 'spearman_correlation'].includes(test.testName)) {
      const xKey = cols.x
      const yKey = cols.y
      const data = numericRows(rows, xKey, yKey)
      if (!data.length) return
      add(test, {
        id: `scatter_${i}`,
        type: 'scatter plot',
        title: `${columnLabel(schema, xKey)} ve ${columnLabel(schema, yKey)} - scatter plot`,
        subtitle: `${test.testName.startsWith('pearson') ? 'Pearson' : 'Spearman'} r = ${Number(res.r ?? res.rho ?? 0).toFixed(3)}, ${pLabel(p)}`,
        component: <ScatterPlot data={data} trend={linearTrend(data)} xLabel={columnLabel(schema, xKey)} yLabel={columnLabel(schema, yKey)} />
      })
    }

    if (['chi_square', 'chi_square_test', 'fisher_exact', 'fisher_exact_test'].includes(test.testName)) {
      const rowKey = cols.row
      const colKey = cols.col
      if (!rowKey || !colKey) return
      const table = crosstab(rows, schema, rowKey, colKey)
      add(test, { id: `stacked_${i}`, type: 'stacked bar', title: `${columnLabel(schema, rowKey)} x ${columnLabel(schema, colKey)} - stacked bar`, subtitle: pLabel(p), component: <StackedBar rows={rows} rowKey={rowKey} colKey={colKey} /> })
      add(test, { id: `crosstab_${i}`, type: 'çapraz tablo', title: `${columnLabel(schema, rowKey)} x ${columnLabel(schema, colKey)} - çapraz tablo`, subtitle: pLabel(p), component: <SimpleTable columns={table.columns} rows={table.rows} /> })
    }

    if (['linear_regression', 'logistic_regression', 'cox_regression'].includes(test.testName)) {
      const predictor = cols.predictor || cols.covariate || cols.predictors?.[0] || 'predictor'
      const estimate = Number(res.coefficient ?? res.beta ?? res.oddsRatio ?? res.OR ?? res.hazardRatio ?? res.HR ?? 1)
      const se = Number(res.se ?? res.standardError ?? 0.15)
      const isRatio = test.testName !== 'linear_regression'
      const label = test.testName === 'cox_regression' ? 'HR forest plot' : test.testName === 'logistic_regression' ? 'OR forest plot' : 'katsayı grafiği'
      add(test, {
        id: `forest_${i}`,
        type: label,
        title: `${columnLabel(schema, predictor)} - ${label}`,
        subtitle: pLabel(p),
        component: <ForestPlot reference={isRatio ? 1 : 0} items={[{ label: columnLabel(schema, predictor), estimate, low: Number(res.ciLow ?? res.ci_low ?? estimate - 1.96 * se), high: Number(res.ciHigh ?? res.ci_high ?? estimate + 1.96 * se) }]} />
      })
    }

    if (['kaplan_meier', 'log_rank_test'].includes(test.testName)) {
      const timeKey = cols.time
      const eventKey = cols.event
      if (!timeKey || !eventKey) return
      add(test, {
        id: `km_${i}`,
        type: 'Kaplan-Meier + risk table',
        title: `${columnLabel(schema, timeKey)} - Kaplan-Meier eğrisi`,
        subtitle: pLabel(p),
        component: <KaplanMeierChart rows={rows} timeKey={timeKey} eventKey={eventKey} groupKey={cols.group} />
      })
    }

    if (test.testName === 'descriptive_stats') {
      const key = cols.outcome || cols.variable
      if (!key) return
      add(test, { id: `hist_${i}`, type: 'histogram', title: `${columnLabel(schema, key)} - histogram`, subtitle: `n=${res.n ?? rows.length}`, component: <Histogram values={rows.map(row => row[key])} xLabel={columnLabel(schema, key)} /> })
      add(test, { id: `table1_${i}`, type: 'Table 1', title: `${columnLabel(schema, key)} - Table 1`, component: <Table1 rows={rows} schema={schema} variables={[key]} /> })
    }
  })

  return { figures, counts }
}

function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function nodeToSvg(node) {
  const rect = node.getBoundingClientRect()
  const width = Math.max(320, Math.ceil(rect.width))
  const height = Math.max(220, Math.ceil(rect.height))
  const clone = node.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject>
  </svg>`
}

function FigureCard({ figure }) {
  const ref = useRef(null)
  const fileBase = figure.title.toLowerCase().replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '-').replace(/^-|-$/g, '') || 'figure'

  const exportSvg = () => {
    downloadBlob(nodeToSvg(ref.current), `${fileBase}.svg`, 'image/svg+xml;charset=utf-8')
  }

  const exportPng = () => {
    const svg = nodeToSvg(ref.current)
    const image = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width * 2
      canvas.height = image.height * 2
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, image.width, image.height)
      ctx.drawImage(image, 0, 0)
      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, `${fileBase}.png`, 'image/png')
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error('PNG oluşturulamadı.')
    }
    image.src = url
  }

  const exportPdf = () => {
    const popup = window.open('', '_blank')
    if (!popup) return toast.error('PDF için açılır pencereye izin verin.')
    popup.document.write(`<html><head><title>${figure.title}</title><style>body{font-family:Arial,sans-serif;margin:24px}.figure{max-width:900px}.subtitle{color:#666;font-size:12px;margin-bottom:16px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">PDF olarak kaydet</button><div class="figure"><h3>${figure.title}</h3><div class="subtitle">${figure.subtitle || ''}</div>${nodeToSvg(ref.current)}</div><script>setTimeout(()=>window.print(),300)</script></body></html>`)
    popup.document.close()
  }

  return (
    <div className="card">
      <div ref={ref} className="bg-white">
        <div className="mb-3">
          <div className="text-sm font-medium text-gray-800">{figure.title}</div>
          {figure.subtitle && <div className="text-xs text-gray-500 mt-0.5">{figure.subtitle}</div>}
        </div>
        {figure.component}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{figure.type}</span>
        <div className="flex items-center gap-1">
          <button onClick={exportPng} className="px-2 py-1 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-600">PNG</button>
          <button onClick={exportSvg} className="px-2 py-1 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-600">SVG</button>
          <button onClick={exportPdf} className="px-2 py-1 text-[10px] rounded bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-600">PDF</button>
        </div>
      </div>
    </div>
  )
}

export default function Figures() {
  const [statsItems, setStatsItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadedRecord, setLoadedRecord] = useState(null)
  const [schema, setSchema] = useState(null)
  const [figures, setFigures] = useState([])
  const [counts, setCounts] = useState({})
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    listOutputs(OUTPUT_TYPES.STATISTICS).then(setStatsItems).catch(e => toast.error('Analiz kayıtları yüklenemedi: ' + (e.message || '')))
  }, [])

  const statisticalResults = loadedRecord?.result?.results || []
  const requests = useMemo(() => figureRequests(statisticalResults), [statisticalResults])

  const handleLoad = async () => {
    if (!selectedId) return
    setLoading(true)
    setWarnings([])
    setFigures([])
    setCounts({})
    try {
      const record = await getOutput(selectedId)
      const result = record.result || {}
      const sourceDatasetId = result.sourceDatasetId || record.payload?.sourceDatasetId
      if (!sourceDatasetId) {
        setLoadedRecord(record)
        setWarnings([OLD_FORMAT_WARNING])
        toast.error(OLD_FORMAT_WARNING)
        return
      }

      const rows = await loadDatasetRows(sourceDatasetId)
      const nextRequests = figureRequests(result.results || [])
      const nextSchema = {
        studyTitle: result.schema?.studyTitle || record.payload?.schema?.studyTitle || record.title,
        columns: result.schema?.columns || record.payload?.schema?.columns || [],
        rows
      }

      const backend = await figuresAPI.generate({
        statisticsOutputId: record.id,
        sourceDatasetId,
        statisticalResults: result.results || [],
        requests: nextRequests
      }).catch(e => ({ warnings: [e.message || 'Backend figür isteği tamamlanamadı.'] }))

      const generated = buildFigures(result.results || [], nextSchema, rows)
      setLoadedRecord(record)
      setSchema(nextSchema)
      setFigures(generated.figures)
      setCounts(generated.counts)
      setWarnings(backend.warnings || [])
      toast.success(`${generated.figures.length} figür oluşturuldu`)
    } catch (e) {
      toast.error('Analiz yüklenemedi: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const testCountRows = Object.entries(counts).map(([testName, count]) => ({ testName, count }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        icon="ti-chart-dots"
        title="Görselleştirme Stüdyosu"
        subtitle="Kayıtlı istatistiksel analizlerden otomatik publication-ready figürler"
        actions={<SavedBadge type={OUTPUT_TYPES.FIGURES} />}
      />

      <div className="card mb-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Kayıtlı istatistiksel analiz</label>
            <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Analiz seç...</option>
              {statsItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.is_pinned ? '📌 ' : ''}{item.title}{item.summary ? ` — ${item.summary}` : ''} · {new Date(item.created_at).toLocaleDateString('tr-TR')}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleLoad} disabled={!selectedId || loading} className="btn-primary disabled:opacity-40">
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-download text-sm" />}
            Yükle
          </button>
        </div>

        {loadedRecord && schema && (
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
            <StatBox label="Analiz" value={statisticalResults.length} color="brand" />
            <StatBox label="Figür" value={figures.length} color="green" />
            <StatBox label="Dataset n" value={schema.rows.length} color="blue" />
            <StatBox label="Değişken" value={schema.columns.length} color="amber" />
          </div>
        )}

        {!!warnings.length && (
          <div className="mt-4 space-y-2">
            {warnings.map((warning, i) => (
              <div key={i} className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <i className="ti ti-alert-circle mr-1" />{warning}
              </div>
            ))}
          </div>
        )}
      </div>

      {!!testCountRows.length && (
        <div className="card mb-5">
          <div className="section-title mb-3">Test başına üretilen figür</div>
          <div className="flex flex-wrap gap-2">
            {testCountRows.map(row => (
              <span key={row.testName} className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1">
                {row.testName}: <b>{row.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {figures.length > 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            {figures.map(figure => <FigureCard key={figure.id} figure={figure} />)}
          </div>
          <SaveBar
            type={OUTPUT_TYPES.FIGURES}
            title={`Figürler: ${loadedRecord?.title || 'Analiz'} — ${new Date().toLocaleDateString('tr-TR')}`}
            payload={{
              statisticsOutputId: loadedRecord?.id,
              sourceDatasetId: loadedRecord?.result?.sourceDatasetId,
              requests
            }}
            result={{
              statisticsOutputId: loadedRecord?.id,
              sourceDatasetId: loadedRecord?.result?.sourceDatasetId,
              sourceStatisticsTitle: loadedRecord?.title,
              figureCount: figures.length,
              figures: figures.map(f => ({ id: f.id, type: f.type, title: f.title, subtitle: f.subtitle, sourceTest: f.sourceTest }))
            }}
            summary={`${figures.length} figür — ${[...new Set(figures.map(f => f.type))].join(', ')}`}
          />
        </div>
      ) : (
        <EmptyState
          icon="ti-chart-dots"
          title={loading ? 'Figürler hazırlanıyor' : 'Kayıtlı analiz seçin'}
          description={loading ? 'Analiz kaydı ve bağlı dataset satırları yükleniyor.' : 'Figür oluşturmak için İstatistik sayfasında kaydedilmiş bir analiz seçin.'}
        />
      )}
    </div>
  )
}
