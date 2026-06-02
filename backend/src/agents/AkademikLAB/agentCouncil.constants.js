export const AGENT_COUNCIL_AGENT_NAME = 'AkademikLAB'
export const AGENT_COUNCIL_MODEL = 'deepseek-v4-flash'

export const AGENT_STATUS = {
  IDLE: 'idle',
  COLLECTING_INPUT: 'collecting_input',
  READY: 'ready',
  RUNNING: 'running',
  COMPLETED: 'completed',
  NEEDS_REVIEW: 'needs_review',
  ERROR: 'error'
}

export const AGENTS = [
  { id: 'introduction', name: 'Introduction Agent', sectionKey: 'introduction' },
  { id: 'materialsMethods', name: 'Materials and Methods Agent', sectionKey: 'materialsMethods' },
  { id: 'results', name: 'Results Agent', sectionKey: 'results' },
  { id: 'discussion', name: 'Discussion Agent', sectionKey: 'discussion' },
  { id: 'limitations', name: 'Limitations Agent', sectionKey: 'limitations' },
  { id: 'conclusion', name: 'Conclusion Agent', sectionKey: 'conclusion' },
  { id: 'abstract', name: 'Abstract Agent', sectionKey: 'abstract' },
  { id: 'references', name: 'References Agent', sectionKey: 'references' },
  { id: 'editor', name: 'Editor Agent', sectionKey: 'editor' }
]

export const FULL_MANUSCRIPT_ORDER = [
  'introduction',
  'materialsMethods',
  'results',
  'discussion',
  'limitations',
  'conclusion',
  'abstract',
  'references',
  'editor'
]

export const EVIDENCE_SECTIONS = [
  'abstract',
  'introduction',
  'results',
  'discussion',
  'conclusion',
  'limitations',
  'methods',
  'other',
  'uploaded_pdf'
]
