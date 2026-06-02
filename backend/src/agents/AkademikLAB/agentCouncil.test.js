import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateAbstractInput,
  validateIntroductionInput,
  validateMaterialsMethodsInput,
  validateResultsInput
} from './agentCouncil.validators.js'
import { resolveReferences } from './referenceResolver.service.js'
import {
  runPostChecks,
  validateEthicsApprovalInMethods,
  validateNoCitationInAbstract,
  validateNoNewReferencesFromEditor,
  validateNoUnusedReferences,
  validateReferenceTokensResolved,
  validateResultsNumericClaims,
  validateSelectedArticleBoundaries
} from './manuscriptPostCheck.service.js'
import { buildAgentContext } from './projectContextBuilder.service.js'
import { createInitialAgentCouncilState } from './agentCouncil.state.js'
import fs from 'node:fs'

const ARTICLE_A = '11111111-1111-4111-8111-111111111111'
const ARTICLE_B = '22222222-2222-4222-8222-222222222222'
const ARTICLE_C = '33333333-3333-4333-8333-333333333333'

test('Introduction proje ve kelime sayısı olmadan reddedilir', () => {
  assert.equal(validateIntroductionInput({}).code, 'MISSING_PROJECT')
  assert.equal(validateIntroductionInput({ projectId: 'p1' }).code, 'MISSING_WORD_TARGET')
})

test('Materials and Methods etik kurul bilgileri eksikse reddedilir', () => {
  const result = validateMaterialsMethodsInput({ projectId: 'p1', ethicsApproval: {}, studyType: 'retrospektif' })
  assert.equal(result.code, 'MISSING_ETHICS_COMMITTEE')
})

test('Results seçili analiz sonucu olmadan reddedilir', () => {
  assert.equal(validateResultsInput({ projectId: 'p1', selectedResultIds: [] }).code, 'MISSING_SELECTED_RESULTS')
  assert.equal(validateResultsInput({ projectId: 'p1', selectedResultIds: ['r1'] }).success, true)
})

test('Session state içinde tek projectId tutulur', () => {
  const state = createInitialAgentCouncilState({ projectId: 'project-1' })
  assert.equal(state.projectId, 'project-1')
  assert.equal(Object.prototype.hasOwnProperty.call(state.userSelections, 'projectId'), false)
})

test('Writing kartları içinde proje dropdown yok ve global aktif proje alanı var', () => {
  const source = fs.readFileSync(new URL('../../../../frontend/src/pages/Writing/index.jsx', import.meta.url), 'utf8')
  const agentCardSource = source.match(/function AgentCard[\s\S]*?function selectedOptionText/)?.[0] || ''
  assert.match(source, /Aktif proje:/)
  assert.doesNotMatch(agentCardSource, /<select/)
})

test('Global proje seçilmeden ajan çalıştırma açıklaması yazım ekranında bulunur', () => {
  const source = fs.readFileSync(new URL('../../../../frontend/src/pages/Writing/index.jsx', import.meta.url), 'utf8')
  assert.match(source, /Önce manuscript için bir proje seçin\./)
})

test('Introduction yalnızca seçili proje makalelerini alır', () => {
  const context = buildAgentContext('introduction', {
    project: { id: 'p1', metadata: {} },
    articles: [
      { id: ARTICLE_A, chunks: [{ section: 'abstract' }] },
      { id: ARTICLE_B, chunks: [{ section: 'abstract' }] }
    ]
  }, { selectedArticleIds: [ARTICLE_A] }, {})
  assert.deepEqual(context.articles.map(item => item.id), [ARTICLE_A])
})

test('Results yalnızca seçili proje statistics/table/figure kayıtlarını alır ve literatür almaz', () => {
  const context = buildAgentContext('results', {
    statistics: [{ id: 's1' }, { id: 's2' }],
    tables: [{ id: 't1' }],
    figures: [{ id: 'f1' }],
    articles: [{ id: ARTICLE_A }]
  }, { selectedResultIds: ['s2'], selectedTableIds: ['t1'], selectedFigureIds: ['f1'] }, {})
  assert.deepEqual(context.selectedStatistics.map(item => item.id), ['s2'])
  assert.deepEqual(context.selectedTables.map(item => item.id), ['t1'])
  assert.deepEqual(context.selectedFigures.map(item => item.id), ['f1'])
  assert.equal(context.articles, undefined)
})

test('Discussion yalnızca seçilen proje makalelerini görebilir', () => {
  const context = buildAgentContext('discussion', {
    articles: [
      { id: ARTICLE_A, chunks: [{ section: 'discussion' }] },
      { id: ARTICLE_B, chunks: [{ section: 'discussion' }] }
    ]
  }, { selectedArticleIds: [ARTICLE_B] }, { results: 'R' })
  assert.deepEqual(context.articles.map(item => item.id), [ARTICLE_B])
})

test('Materials and Methods proje metadata içindeki etik kurul bilgisini kullanır', () => {
  const context = buildAgentContext('materialsMethods', {
    project: {
      metadata: {
        ethics_committee_name: 'PICU Etik Kurulu',
        ethics_approval_date: '2026-01-01',
        ethics_approval_number: '42'
      }
    },
    datasets: [{ id: 'd1' }],
    statistics: [{ id: 's1' }]
  }, { selectedDatasetIds: ['d1'], selectedResultIds: ['s1'] }, {})
  assert.equal(context.ethics.committeeName, 'PICU Etik Kurulu')
  assert.deepEqual(context.datasets.map(item => item.id), ['d1'])
})

test('Abstract yalnızca üretilmiş manuscript bölümlerini kullanır', () => {
  const context = buildAgentContext('abstract', { articles: [{ id: ARTICLE_A }] }, {}, {
    introduction: 'I',
    materialsMethods: 'M',
    results: 'R',
    discussion: 'D',
    conclusion: 'C'
  })
  assert.deepEqual(Object.keys(context), ['introduction', 'materialsMethods', 'results', 'discussion', 'conclusion'])
})

test('Başka kullanıcıya ait output context sorgusuna alınmaz ve legacy null otomatik bağlanmaz', () => {
  const source = fs.readFileSync(new URL('../../services/project.service.js', import.meta.url), 'utf8')
  assert.match(source, /\.eq\('user_id', project\.user_id\)/)
  assert.doesNotMatch(source, /project_id:\s*projectId[\s\S]*maybeSingle\(\)/)
})

test('Kullanıcı eski output kaydını manuel projeye bağlayabilir', () => {
  const source = fs.readFileSync(new URL('../../services/project.service.js', import.meta.url), 'utf8')
  assert.match(source, /export async function attachResearchOutputToProject/)
  assert.match(source, /\.update\(\{ project_id: projectId \}\)/)
})

test('Context pool counts dataset statistics table figure döndürür', () => {
  const source = fs.readFileSync(new URL('../../services/project.service.js', import.meta.url), 'utf8')
  assert.match(source, /counts:\s*\{[\s\S]*datasets:[\s\S]*statistics:[\s\S]*tables:[\s\S]*figures:/)
})

test('Abstract için ana bölümler ve hedef kelime sayısı gerekir', () => {
  const result = validateAbstractInput({ generatedSections: {}, abstractType: 'structured' })
  assert.equal(result.code, 'MISSING_MANUSCRIPT_SECTIONS')
})

test('References resolver aynı article_id için tek numara üretir ve ilk görünme sırasını korur', () => {
  const state = resolveReferences({
    generatedSections: {
      introduction: `İlk iddia [REF:${ARTICLE_B}]. Tekrar [REF:${ARTICLE_B}].`,
      discussion: `Sonra başka kaynak [REF:${ARTICLE_A}].`
    },
    referenceRegistry: [
      { articleId: ARTICLE_A, title: 'A Article', authors: ['A Author'], journal: 'J1', publication_year: 2024 },
      { articleId: ARTICLE_B, title: 'B Article', authors: ['B Author'], journal: 'J2', publication_year: 2025 }
    ]
  })

  assert.deepEqual(state.citationMap, { [ARTICLE_B]: 1, [ARTICLE_A]: 2 })
  assert.match(state.generatedSections.introduction, /\[1\].*\[1\]/s)
  assert.match(state.generatedSections.discussion, /\[2\]/)
  assert.match(state.references, /^1\. B Author\./)
})

test('Abstract citation içerirse post-check hata üretir', () => {
  const issues = validateNoCitationInAbstract({ generatedSections: { abstract: `Özet [REF:${ARTICLE_A}] ve [1].` } })
  assert.equal(issues[0].code, 'ABSTRACT_CONTAINS_CITATION')
})

test('Editor yeni referans tokenı eklerse hata üretir', () => {
  const issues = validateNoNewReferencesFromEditor(
    { generatedSections: { introduction: `Mevcut [REF:${ARTICLE_A}]` } },
    `Revize metin [REF:${ARTICLE_A}] [REF:${ARTICLE_B}]`
  )
  assert.equal(issues[0].code, 'EDITOR_ADDED_REFERENCE')
  assert.deepEqual(issues[0].details.added, [ARTICLE_B])
})

test('Çözülemeyen REF token finalize kontrolünde yakalanır', () => {
  const issues = validateReferenceTokensResolved({ generatedSections: { introduction: `Metin [REF:${ARTICLE_A}]` } })
  assert.equal(issues[0].code, 'UNRESOLVED_REF_TOKEN')
})

test('Kaynakçada kullanılmayan referans varsa uyarı üretir', () => {
  const issues = validateNoUnusedReferences({
    citationMap: { [ARTICLE_A]: 1 },
    generatedSections: { references: '1. A\n2. B' }
  })
  assert.equal(issues[0].code, 'UNUSED_REFERENCE')
  assert.equal(issues[0].severity, 'warning')
})

test('Methods içinde beklenen etik kurul bilgisi yoksa uyarı üretir', () => {
  const issues = validateEthicsApprovalInMethods({
    ethicsApproval: { committeeName: 'PICU Etik Kurulu', decisionDate: '2026-01-01', decisionNumber: '42' },
    generatedSections: { materialsMethods: 'Çalışma retrospektif olarak tasarlandı.' }
  })
  assert.equal(issues[0].code, 'ETHICS_INFO_MISSING_IN_METHODS')
})

test('Discussion seçili makale sınırları dışına çıkarsa hata üretir', () => {
  const issues = validateSelectedArticleBoundaries({
    selectedArticles: [{ id: ARTICLE_A }],
    generatedSections: { discussion: `Karşılaştırma [REF:${ARTICLE_C}]` }
  })
  assert.equal(issues[0].code, 'REFERENCE_OUTSIDE_SELECTED_ARTICLES')
})

test('Results metninde context dışı sayısal değer varsa needs_review uyarısı üretir', () => {
  const issues = validateResultsNumericClaims({
    selectedResults: [{ result: { pValue: 0.04, n: 120 } }],
    generatedSections: { results: 'Toplam n=120 idi; p=0.04. Ek olarak p=0.001 bildirildi.' }
  })
  assert.equal(issues[0].code, 'RESULTS_NUMERIC_CLAIM_OUTSIDE_CONTEXT')
  assert.equal(issues[0].severity, 'warning')
})

test('Finalize post-check zorunlu bölümler eksikse başarısız olur', () => {
  const result = runPostChecks({ generatedSections: { introduction: 'Giriş' } }, { finalize: true })
  assert.equal(result.success, false)
  assert.ok(result.issues.some(item => item.code === 'MISSING_REQUIRED_SECTIONS'))
})

test('Opsiyonel canlı LLM testi env kapalıysa skip edilir', { skip: process.env.RUN_LIVE_LLM_TESTS !== 'true' }, () => {
  assert.ok(process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY gerekli')
})

test('Opsiyonel gerçek Supabase/RLS testi env kapalıysa skip edilir', { skip: process.env.RUN_SUPABASE_INTEGRATION_TESTS !== 'true' }, () => {
  assert.ok(process.env.SUPABASE_URL, 'SUPABASE_URL gerekli')
  assert.ok(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY gerekli')
})
