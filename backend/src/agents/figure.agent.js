import { createModel } from '../services/openai.service.js'
import { 
  createBoxPlot, 
  createViolinPlot, 
  createROC, 
  createKaplanMeier, 
  createTable 
} from '../tools/figure.tools.js'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

const SYSTEM = `Sen bir akademik figür tasarım agentısın. Çalışmaya uygun şekil türlerini belirle, spesifikasyonlar oluştur ve dergi yönergelerine uygun figure legend'ları yaz. 
Çıktını mutlaka şu JSON formatında ver:
{
  "decision": "...",
  "figures": [
    { "type": "boxplot", "data": [...], "x": "...", "y": "...", "group": "..." },
    ...
  ],
  "tables": [
    { "title": "...", "columns": [...], "rows": [...] }
  ],
  "exportSuggestions": "..."
}`

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export const run = async (body) => {
  const { statisticalPlan } = body
  const model = createModel({ temperature: 0.4 })

  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(`İstatistiksel plan:\n${statisticalPlan ?? ''}\n\nGerekli şekilleri ve açıklamalarını oluştur.`),
  ])

  const output = safeJsonParse(response.content) || {}
  const decision = output.decision

  const visuals = [];

  for (const fig of output.figures || []) {
    if (fig.type === "boxplot") {
      visuals.push(createBoxPlot(fig));
    }

    if (fig.type === "violin") {
      visuals.push(createViolinPlot(fig));
    }

    if (fig.type === "roc") {
      visuals.push(createROC(fig));
    }

    if (fig.type === "kaplan_meier") {
      visuals.push(createKaplanMeier(fig));
    }
  }

  const tables = (output.tables || []).map(table =>
    createTable(table)
  );

  return {
    success: true,
    decision,
    tables,
    visuals,
    exportSuggestions: output.exportSuggestions
  };
}
