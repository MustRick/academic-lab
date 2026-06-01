const BASE = 'https://consensus.app/api'

export const searchConsensus = async (query, limit = 5) => {
  const res = await fetch(
    `${BASE}/papers/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: { 'Content-Type': 'application/json' } }
  )
  if (!res.ok) throw new Error(`Consensus API hatası: ${res.status}`)
  const data = await res.json()
  return (data.papers ?? []).map((p) => ({
    title: p.title,
    year: p.year,
    journal: p.journal?.title,
    url: p.url,
    conclusion: p.conclusion_type,
    snippet: p.display_text,
  }))
}
