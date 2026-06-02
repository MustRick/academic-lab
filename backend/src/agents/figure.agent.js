import { createClient } from '@supabase/supabase-js'
import {
  createBoxPlot,
  createViolinPlot,
  createKaplanMeier,
  createTable
} from '../tools/figure.tools.js'

function scopedSupabase(token) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  )
}

function getStatPayload(statRecord) {
  const result = statRecord?.result || {}
  const payload = statRecord?.payload || {}
  return {
    result,
    payload,
    sourceDatasetId: result.sourceDatasetId || payload.sourceDatasetId || null,
    sourceDatasetTitle: result.sourceDatasetTitle || payload.sourceDatasetTitle || null,
    sourceDatasetVersion: result.sourceDatasetVersion || payload.sourceDatasetVersion || null,
    schema: result.schema || payload.schema || null,
    statisticalResults: result.results || [],
    n: result.n || null
  }
}

async function loadStatisticsRecord(db, id, userId) {
  const { data, error } = await db
    .from('research_outputs')
    .select('*')
    .eq('id', id)
    .eq('type', 'statistics')
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`İstatistik kaydı okunamadı: ${error.message}`)
  if (!data) throw new Error('İstatistik kaydı bulunamadı.')
  return data
}

async function loadRows(db, sourceDatasetId) {
  if (!sourceDatasetId) return []
  const { data, error } = await db
    .from('dataset_rows')
    .select('row_index, data')
    .eq('output_id', sourceDatasetId)
    .order('row_index')

  if (error) throw new Error(`Kaynak dataset satırları okunamadı: ${error.message}`)
  return (data || []).map(row => row.data)
}

function columnLabel(schema, key) {
  return schema?.columns?.find(column => column.key === key)?.label || key || '—'
}

function resultTable(statisticalResults) {
  return createTable({
    title: 'Kaydedilmiş İstatistik Sonuçları',
    columns: ['Test', 'Değişkenler', 'p değeri', 'Durum'],
    rows: statisticalResults.map(item => ({
      Test: item.displayName || item.testName,
      Değişkenler: item.columns
        ? Object.entries(item.columns)
            .map(([role, value]) => `${role}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('; ')
        : '—',
      'p değeri': item.result?.pValue ?? item.result?.p_value ?? item.result?.p ?? '—',
      Durum: item.status || '—'
    }))
  })
}

function regressionTable(statisticalResults) {
  const regression = statisticalResults.filter(item =>
    ['linear_regression', 'logistic_regression', 'cox_regression'].includes(item.testName)
  )

  return createTable({
    title: 'Regresyon Sonuçları',
    columns: ['Test', 'Outcome', 'Predictor', 'Katsayı / OR / HR', 'p değeri'],
    rows: regression.map(item => ({
      Test: item.displayName || item.testName,
      Outcome: item.columns?.outcome || '—',
      Predictor: item.columns?.predictor || item.columns?.predictors?.join?.(', ') || '—',
      'Katsayı / OR / HR': item.result?.coefficient ?? item.result?.oddsRatio ?? item.result?.hazardRatio ?? '—',
      'p değeri': item.result?.pValue ?? item.result?.p_value ?? item.result?.p ?? '—'
    }))
  })
}

function crosstabTable(rows, spec, schema) {
  const rowKey = spec.mapping?.row
  const colKey = spec.mapping?.col
  const rowValues = [...new Set(rows.map(row => row[rowKey]).filter(value => value !== null && value !== undefined && value !== '').map(String))]
  const colValues = [...new Set(rows.map(row => row[colKey]).filter(value => value !== null && value !== undefined && value !== '').map(String))]

  return createTable({
    title: spec.title || `${columnLabel(schema, rowKey)} x ${columnLabel(schema, colKey)}`,
    columns: [columnLabel(schema, rowKey), ...colValues],
    rows: rowValues.map(rowValue => {
      const next = { [columnLabel(schema, rowKey)]: rowValue }
      colValues.forEach(colValue => {
        next[colValue] = rows.filter(row => String(row[rowKey]) === rowValue && String(row[colKey]) === colValue).length
      })
      return next
    })
  })
}

function table1(rows, spec, schema) {
  const variables = spec.mapping?.variables || schema?.columns?.slice(0, 8).map(column => column.key) || []

  return createTable({
    title: spec.title || 'Table 1',
    columns: ['Değişken', 'Özet', 'Eksik'],
    rows: variables.map(key => {
      const column = schema?.columns?.find(item => item.key === key)
      const values = rows.map(row => row[key]).filter(value => value !== null && value !== undefined && value !== '')
      const missing = Math.max(0, rows.length - values.length)
      let summary = '—'

      if (column?.type === 'number') {
        const nums = values.map(Number).filter(Number.isFinite)
        if (nums.length) {
          const avg = nums.reduce((sum, value) => sum + value, 0) / nums.length
          summary = `${avg.toFixed(2)} ± ${Math.sqrt(nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / Math.max(nums.length - 1, 1)).toFixed(2)}`
        }
      } else {
        summary = [...new Set(values.map(String))]
          .slice(0, 4)
          .map(value => {
            const count = values.filter(item => String(item) === value).length
            return `${value}: ${count} (${((count / Math.max(values.length, 1)) * 100).toFixed(1)}%)`
          })
          .join(', ')
      }

      return {
        Değişken: column?.label || key,
        Özet: summary,
        Eksik: missing
      }
    })
  })
}

function visualFromSpec(spec, rows, schema) {
  if (spec.kind === 'boxplot') {
    return createBoxPlot({
      data: rows,
      x: spec.mapping?.x,
      y: spec.mapping?.y,
      group: spec.mapping?.x,
      title: spec.title,
      legend: spec.legend
    })
  }

  if (spec.kind === 'violin') {
    return createViolinPlot({
      data: rows,
      x: spec.mapping?.x,
      y: spec.mapping?.y,
      group: spec.mapping?.x,
      title: spec.title,
      legend: spec.legend
    })
  }

  if (spec.kind === 'scatter') {
    return {
      type: 'scatter',
      x: spec.mapping?.x,
      y: spec.mapping?.y,
      group: spec.mapping?.group || null,
      title: spec.title,
      legend: spec.legend,
      data: rows.map(row => ({
        x: Number(row[spec.mapping?.x]),
        y: Number(row[spec.mapping?.y]),
        group: spec.mapping?.group ? row[spec.mapping.group] : null
      })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
      library: 'plotly'
    }
  }

  if (['grouped_bar', 'stacked_bar'].includes(spec.kind)) {
    return {
      type: spec.kind,
      x: spec.mapping?.x,
      group: spec.mapping?.group || null,
      title: spec.title,
      legend: spec.legend,
      data: rows,
      library: 'plotly'
    }
  }

  if (spec.kind === 'kaplan_meier') {
    return createKaplanMeier({
      groups: [],
      title: spec.title,
      mapping: spec.mapping,
      sourceColumns: {
        time: columnLabel(schema, spec.mapping?.time),
        event: columnLabel(schema, spec.mapping?.event),
        group: columnLabel(schema, spec.mapping?.group)
      }
    })
  }

  if (spec.kind === 'forest_plot') {
    return {
      type: 'forest_plot',
      title: spec.title || 'Forest Plot',
      legend: spec.legend,
      library: 'plotly'
    }
  }

  return null
}

export const run = async (body, context = {}) => {
  const { statisticsOutputId, requests = [] } = body || {}
  const { user, token } = context

  if (!user?.id || !token) {
    throw new Error('Kimlik doğrulama gerekli.')
  }

  if (!statisticsOutputId) {
    throw new Error('statisticsOutputId zorunlu.')
  }

  const db = scopedSupabase(token)
  const statRecord = await loadStatisticsRecord(db, statisticsOutputId, user.id)
  const statPayload = getStatPayload(statRecord)
  const rows = await loadRows(db, statPayload.sourceDatasetId)

  const visuals = []
  const tables = []
  const warnings = []

  if (!statPayload.sourceDatasetId) {
    warnings.push('Bu kayıt eski formatta oluşturulmuş. Figür oluşturmak için İstatistik sayfasında analizi yeniden çalıştırıp kaydedin.')
  }

  for (const spec of requests) {
    const needsRows = spec.kind && !['forest_plot', 'regression_table', 'risk_table', 'table1'].includes(spec.kind)

    if (needsRows && !rows.length) {
      warnings.push(`${spec.title || spec.kind}: kaynak satır olmadığı için atlandı.`)
      continue
    }

    if (spec.kind === 'table1') {
      tables.push(rows.length ? table1(rows, spec, statPayload.schema) : resultTable(statPayload.statisticalResults))
      continue
    }

    if (spec.kind === 'crosstab') {
      if (rows.length) tables.push(crosstabTable(rows, spec, statPayload.schema))
      continue
    }

    if (spec.kind === 'regression_table') {
      tables.push(regressionTable(statPayload.statisticalResults))
      continue
    }

    if (spec.kind === 'risk_table') {
      tables.push(createTable({
        title: spec.title || 'Risk Table',
        columns: ['Zaman', 'Riskteki hasta sayısı'],
        rows: []
      }))
      continue
    }

    const visual = visualFromSpec(spec, rows, statPayload.schema)
    if (visual) visuals.push(visual)
  }

  if (!tables.length && statPayload.statisticalResults.length) {
    tables.push(resultTable(statPayload.statisticalResults))
  }

  return {
    success: true,
    statisticsOutputId,
    sourceDatasetId: statPayload.sourceDatasetId,
    decision: 'Figür ve tablolar kayıtlı istatistiksel analiz paketinden üretildi.',
    visuals,
    tables,
    warnings,
    exportSuggestions: 'PNG/SVG figür ve DOCX tablo çıktısı için publication-ready şablon kullanılabilir.'
  }
}
