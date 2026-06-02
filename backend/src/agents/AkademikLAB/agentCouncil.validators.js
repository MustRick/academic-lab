function ok() {
  return { success: true }
}

function fail(code, message) {
  return { success: false, code, message }
}

export function validateProjectSelection(input = {}) {
  return input.projectId ? ok() : fail('MISSING_PROJECT', 'Proje seçin.')
}

export function validateIntroductionInput(input = {}) {
  if (!input.projectId) return fail('MISSING_PROJECT', 'Introduction için proje seçin.')
  if (!input.wordTarget) return fail('MISSING_WORD_TARGET', 'Introduction için hedef kelime sayısını seçin.')
  return ok()
}

export function validateMaterialsMethodsInput(input = {}) {
  if (!input.projectId) return fail('MISSING_PROJECT', 'Materials and Methods için proje seçin.')
  const ethics = input.ethicsApproval || {}
  if (!ethics.committeeName) return fail('MISSING_ETHICS_COMMITTEE', 'Etik kurul adını girin.')
  if (!ethics.decisionDate) return fail('MISSING_ETHICS_DATE', 'Etik kurul karar tarihini girin.')
  if (!ethics.decisionNumber) return fail('MISSING_ETHICS_NUMBER', 'Etik kurul karar numarasını girin.')
  if (!input.studyType) return fail('MISSING_STUDY_TYPE', 'Çalışma tipini girin.')
  return ok()
}

export function validateResultsInput(input = {}) {
  if (!input.projectId) return fail('MISSING_PROJECT', 'Results için proje seçin.')
  const selected = input.selectedResults || input.selectedResultIds
  if (!Array.isArray(selected) || selected.length === 0) {
    return fail('MISSING_SELECTED_RESULTS', 'Yazılacak analiz sonuçlarını seçin.')
  }
  return ok()
}

export function validateDiscussionInput(input = {}) {
  if (!input.projectId) return fail('MISSING_PROJECT', 'Discussion için proje seçin.')
  if (!input.resultsText) return fail('MISSING_RESULTS_TEXT', 'Discussion için Results çıktısı gerekli.')
  if (!Array.isArray(input.selectedArticleIds) || input.selectedArticleIds.length === 0) {
    return fail('MISSING_SELECTED_ARTICLES', 'Karşılaştırma yapılacak makaleleri seçin.')
  }
  return ok()
}

export function validateAbstractInput(input = {}) {
  if (!input.generatedSections?.introduction || !input.generatedSections?.materialsMethods || !input.generatedSections?.results) {
    return fail('MISSING_MANUSCRIPT_SECTIONS', 'Abstract için önce ana bölümleri oluşturun.')
  }
  if (!input.abstractType) return fail('MISSING_ABSTRACT_TYPE', 'Abstract tipini seçin.')
  if (!input.wordTarget) return fail('MISSING_WORD_TARGET', 'Abstract hedef kelime sayısını seçin.')
  return ok()
}

export function validateReferenceTokens(text = '') {
  const malformed = text.match(/\[REF:(?![0-9a-f-]{8,})[^\]]+\]/i)
  if (malformed) return fail('INVALID_REFERENCE_TOKEN', `Geçersiz referans token: ${malformed[0]}`)
  return ok()
}

export function validateAgentCouncilInput(input = {}) {
  if (!input.agentId) return fail('MISSING_AGENT', 'Ajan seçin.')
  return ok()
}

export function validateForAgent(agentId, input = {}) {
  if (agentId === 'introduction') return validateIntroductionInput(input)
  if (agentId === 'materialsMethods') return validateMaterialsMethodsInput(input)
  if (agentId === 'results') return validateResultsInput(input)
  if (agentId === 'discussion') return validateDiscussionInput(input)
  if (agentId === 'abstract') return validateAbstractInput(input)
  return validateProjectSelection(input)
}
