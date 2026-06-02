const REF_RE = /\[REF:([0-9a-f-]{8,})\]/gi

function articleLine(article, number) {
  const authors = Array.isArray(article.authors) && article.authors.length
    ? article.authors.join(', ')
    : 'Yazar bilgisi yok'
  const parts = [
    `${number}. ${authors}.`,
    article.title,
    article.journal,
    article.publication_year,
    article.doi ? `DOI: ${article.doi}.` : article.pmid ? `PMID: ${article.pmid}.` : ''
  ].filter(Boolean)
  return parts.join(' ')
}

export function extractReferenceTokens(text = '') {
  return [...String(text).matchAll(REF_RE)].map(match => match[1])
}

export function resolveReferences({ generatedSections = {}, referenceRegistry = [] }) {
  const sourceText = [
    generatedSections.introduction,
    generatedSections.discussion
  ].filter(Boolean).join('\n\n')

  const orderedIds = []
  for (const articleId of extractReferenceTokens(sourceText)) {
    if (!orderedIds.includes(articleId)) orderedIds.push(articleId)
  }

  const citationMap = Object.fromEntries(orderedIds.map((articleId, index) => [articleId, index + 1]))
  const replaceTokens = text => String(text || '').replace(REF_RE, (_token, articleId) => {
    const number = citationMap[articleId]
    return number ? `[${number}]` : '[?]'
  })

  const resolvedSections = {
    ...generatedSections,
    introduction: replaceTokens(generatedSections.introduction),
    discussion: replaceTokens(generatedSections.discussion)
  }

  const byId = new Map(referenceRegistry.map(article => [article.articleId || article.id, article]))
  const references = orderedIds.map((articleId, index) => {
    const article = byId.get(articleId) || { title: `Eksik metadata: ${articleId}`, authors: [] }
    return articleLine(article, index + 1)
  }).join('\n')

  return {
    generatedSections: {
      ...resolvedSections,
      references
    },
    citationMap,
    references,
    orderedArticleIds: orderedIds
  }
}
