import { ChatOpenAI } from '@langchain/openai'

export const createModel = (options = {}) =>
  new ChatOpenAI({
    model: options.model ?? 'gpt-4o-mini',
    apiKey: options.model?.startsWith?.('deepseek')
      ? process.env.DEEPSEEK_API_KEY
      : process.env.OPENAI_API_KEY,
    temperature: options.temperature ?? 0.7,
    configuration: options.model?.startsWith?.('deepseek')
      ? { baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1' }
      : options.configuration,
    ...options,
  })

export const model = createModel()
