const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export const searchPubMed = async (query, maxResults = 10) => {
  const searchRes = await fetch(
    `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`
  )
  const searchData = await searchRes.json()
  const ids = searchData.esearchresult?.idlist ?? []
  if (!ids.length) return []

  const summaryRes = await fetch(
    `${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
  )
  const summaryData = await summaryRes.json()

  return ids.map((id) => {
    const a = summaryData.result[id]
    return {
      pmid: id,
      title: a.title,
      authors: a.authors?.map((x) => x.name).join(', ') ?? '',
      journal: a.fulljournalname,
      pubDate: a.pubdate,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    }
  })
}

export const fetchAbstract = async (pmid) => {
  const res = await fetch(
    `${BASE}/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`
  )
  return res.text()
}
