import { ChatOpenAI } from '@langchain/openai'

export const createModel = (options = {}) =>
  new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: options.model ?? 'gpt-4o-mini',
    temperature: options.temperature ?? 0.7,
    ...options,
  })

export const model = createModel()
