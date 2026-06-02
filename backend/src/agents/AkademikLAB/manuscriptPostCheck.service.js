import { extractReferenceTokens } from './referenceResolver.service.js'

const CITATION_IN_ABSTRACT_RE = /(\[REF:|\[\d+(?:\s*[,–-]\s*\d+)*\])/i
const NUMBER_RE = /(?<![A-Za-z])(?:p\s*[<=>]\s*)?\d+(?:[.,]\d+)?%?/gi
const NUMBER_CONTEXT_KEYS = [
  'pValue',
  'p_value',
  'p',
  'confidenceInterval',
  'ci',
  'mean',
  'median',
  'sd',
  'standardDeviation',
  'oddsRatio',
  'riskRatio',
  'hazardRatio',
  'n',
  'count',
  'percentage'
]

function issue(code, message, severity = 'error', details = {}) {
  return { code, message, severity, details }
}

function numbersFromText(text = '') {
  return [...String(text).matchAll(NUMBER_RE)]
    .map(match => match[0].replace(/\s+/g, '').toLowerCase())
    .filter(value => !/^\d{4}$/.test(value))
}

function flattenValues(value, out = []) {
  if (value === null || value === undefined) return out
  if (typeof value === 'number' || typeof value === 'string') {
    out.push(String(value))
    return out
  }
  if (Array.isArray(value)) {
    value.forEach(item => flattenValues(item, out))
    return out
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (NUMBER_CONTEXT_KEYS.some(allowed => key.toLowerCase().includes(allowed.toLowerCase()))) {
        flattenValues(item, out)
      } else if (typeof item === 'object') {
        flattenValues(item, out)
      }
    }
  }
  return out
}

function normalizeNumber(value) {
  return String(value).replace(/\s+/g, '').replace(',', '.').toLowerCase()
}

export function validateNoCitationInAbstract(state) {
  const abstract = state.generatedSections?.abstract || ''
  return CITATION_IN_ABSTRACT_RE.test(abstract)
    ? [issue('ABSTRACT_CONTAINS_CITATION', 'Abstract içinde kaynak atfı bulunmamalıdır.')]
    : []
}

export function validateNoNewReferencesFromEditor(beforeState = {}, afterText = '') {
  const before = new Set(extractReferenceTokens(Object.values(beforeState.generatedSections || {}).join('\n')))
  const after = new Set(extractReferenceTokens(afterText))
  const added = [...after].filter(id => !before.has(id))
  return added.length
    ? [issue('EDITOR_ADDED_REFERENCE', 'Editor yeni referans tokenı ekleyemez.', 'error', { added })]
    : []
}

export function validateReferenceTokensResolved(state) {
  const text = Object.values(state.generatedSections || {}).join('\n')
  const unresolved = extractReferenceTokens(text)
  return unresolved.length
    ? [issue('UNRESOLVED_REF_TOKEN', 'Final metinde çözülemeyen REF token kaldı.', 'error', { unresolved })]
    : []
}

export function validateReferenceRegistryConsistency(state) {
  const registryIds = new Set((state.referenceRegistry || []).map(item => item.articleId || item.id))
  const tokenIds = extractReferenceTokens([
    state.generatedSections?.introduction,
    state.generatedSections?.discussion
  ].filter(Boolean).join('\n'))
  const unknown = [...new Set(tokenIds)].filter(id => !registryIds.has(id))
  return unknown.length
    ? [issue('UNKNOWN_REFERENCE_ARTICLE', 'Bilinmeyen article_id referans tokenı var.', 'error', { unknown })]
    : []
}

export function validateNoUnusedReferences(state) {
  const references = state.generatedSections?.references || ''
  const usedNumbers = new Set([...Object.values(state.citationMap || {})].map(String))
  const listedNumbers = new Set([...references.matchAll(/^(\d+)\./gm)].map(match => match[1]))
  const unused = [...listedNumbers].filter(number => !usedNumbers.has(number))
  return unused.length
    ? [issue('UNUSED_REFERENCE', 'Kaynakçada metinde kullanılmayan referans var.', 'warning', { unused })]
    : []
}

export function validateSelectedArticleBoundaries(state) {
  const selected = new Set((state.selectedArticles || []).map(article => article.id))
  const tokenIds = extractReferenceTokens([
    state.generatedSections?.introduction,
    state.generatedSections?.discussion
  ].filter(Boolean).join('\n'))
  const outside = [...new Set(tokenIds)].filter(id => !selected.has(id))
  return outside.length
    ? [issue('REFERENCE_OUTSIDE_SELECTED_ARTICLES', 'Seçilen makale sınırları dışında referans kullanıldı.', 'error', { outside })]
    : []
}

export function validateResultsNumericClaims(state) {
  const textNumbers = numbersFromText(state.generatedSections?.results || '')
  if (!textNumbers.length) return []

  const allowed = new Set(flattenValues(state.selectedResults || state.context?.selectedStatistics || []).map(normalizeNumber))
  const outside = textNumbers.filter(number => !allowed.has(normalizeNumber(number)))
  return outside.length
    ? [issue('RESULTS_NUMERIC_CLAIM_OUTSIDE_CONTEXT', 'Results metninde seçili analiz context dışında sayısal değer olabilir.', 'warning', { outside: [...new Set(outside)].slice(0, 20) })]
    : []
}

export function validateRequiredSections(state) {
  const required = ['introduction', 'materialsMethods', 'results', 'discussion', 'limitations', 'conclusion', 'abstract', 'references']
  const missing = required.filter(key => !state.generatedSections?.[key])
  return missing.length
    ? [issue('MISSING_REQUIRED_SECTIONS', 'Finalizasyon için zorunlu bölümler eksik.', 'error', { missing })]
    : []
}

export function validateEthicsApprovalInMethods(state) {
  const methods = state.generatedSections?.materialsMethods || ''
  const ethics = state.ethicsApproval || state.userSelections?.ethicsApproval || {}
  const expected = [ethics.committeeName, ethics.decisionDate, ethics.decisionNumber].filter(Boolean)
  const missing = expected.filter(value => !methods.includes(String(value)))
  return missing.length
    ? [issue('ETHICS_INFO_MISSING_IN_METHODS', 'Etik kurul bilgisi Methods bölümünde eksik görünüyor.', 'warning', { missing })]
    : []
}

export function runPostChecks(state, options = {}) {
  const checks = [
    validateNoCitationInAbstract,
    validateReferenceRegistryConsistency,
    validateSelectedArticleBoundaries,
    validateResultsNumericClaims,
    validateEthicsApprovalInMethods
  ]

  if (options.finalize) {
    checks.push(validateReferenceTokensResolved, validateNoUnusedReferences, validateRequiredSections)
  }

  const issues = checks.flatMap(check => check(state))
  return {
    success: !issues.some(item => item.severity === 'error'),
    issues
  }
}
