import { supabase } from '@/lib/supabase'

export const OUTPUT_TYPES = {
  PATIENT_SCAN: 'patient_scan',
  LITERATURE:   'literature',
  DATASET:      'dataset',
  STATISTICS:   'statistics',
  FIGURES:      'figures',
  TABLES:       'tables',
  MANUSCRIPT:   'manuscript',
  REVIEWER:     'reviewer',
}

export async function saveOutput({ type, title, query, payload, result, summary, projectId, tags = [] }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  const { data, error } = await supabase
    .from('research_outputs')
    .insert({ user_id: user.id, project_id: projectId || null, type, title, query: query || null, payload: payload || {}, result: result || {}, summary: summary || null, tags })
    .select().single()
  if (error) throw error
  return data
}

export async function updateOutput(id, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  const { data, error } = await supabase
    .from('research_outputs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select().single()
  if (error) throw error
  return data
}

export async function listOutputs(type, { projectId, limit = 50 } = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  let q = supabase
    .from('research_outputs')
    .select('id, title, query, summary, tags, is_pinned, created_at, updated_at, project_id')
    .eq('user_id', user.id)
    .eq('type', type)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function listAllOutputs({ type, limit = 200 } = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  let q = supabase
    .from('research_outputs')
    .select('id, title, type, query, summary, tags, is_pinned, created_at, updated_at, project_id')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getOutput(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  const { data, error } = await supabase
    .from('research_outputs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (error) throw error
  return data
}

export async function deleteOutput(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  const { error } = await supabase
    .from('research_outputs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
}

export async function togglePin(id, current) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  const { data, error } = await supabase
    .from('research_outputs')
    .update({ is_pinned: !current })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, is_pinned').single()
  if (error) throw error
  return data
}

export async function saveDatasetRows(outputId, rows) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum açık değil.')
  await supabase.from('dataset_rows').delete().eq('output_id', outputId)
  if (!rows.length) return []
  const { data, error } = await supabase
    .from('dataset_rows')
    .insert(rows.map((row, i) => ({ output_id: outputId, user_id: user.id, row_index: i, data: row })))
    .select()
  if (error) throw error
  return data
}

export async function loadDatasetRows(outputId) {
  const { data, error } = await supabase
    .from('dataset_rows').select('row_index, data').eq('output_id', outputId).order('row_index')
  if (error) throw error
  return (data || []).map(r => r.data)
}

export async function gatherWritingContext(projectId) {
  const types = ['patient_scan', 'literature', 'dataset', 'statistics', 'figures']
  const results = {}
  for (const type of types) {
    const list = await listOutputs(type, { projectId, limit: 10 })
    const best = list.find(i => i.is_pinned) || list[0] || null
    if (best) { const full = await getOutput(best.id); results[type] = full }
  }
  return results
}
