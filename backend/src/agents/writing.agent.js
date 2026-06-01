import { createModel } from '../services/openai.service.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

const SYSTEM = `Sen bir akademik yazı agentısın. IMRaD formatında (Giriş, Yöntemler, Bulgular, Tartışma) bilimsel makale bölümleri yaz. Akıcı ve bilimsel dil kullan, atıf yer tutucuları [REF] ekle.`

export const run = async (body) => {
  const { topic, statisticalPlan, literatureSummary } = body
  const model = createModel({ model: 'gpt-4o', temperature: 0.5 })

  const context = [
    topic && `Konu: ${topic}`,
    statisticalPlan && `İstatistiksel plan:\n${statisticalPlan}`,
    literatureSummary && `Literatür özeti:\n${literatureSummary}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(`${context}\n\nGiriş ve Yöntemler bölümlerinin taslağını yaz.`),
  ])

  return { manuscript: response.content }
}
