import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { academicSearchSystemPrompt } from "./prompts/academicSearch.prompt.js";

// DeepSeek v4 flash
const llm = new ChatOpenAI({
  model: "deepseek-v4-flash",
  temperature: 0.3,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL  // https://api.deepseek.com/v1
  }
});

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

export async function run(input) {
  const query =
    typeof input === "string"
      ? input
      : input.query || input.message || input.text || "";

  if (!query) {
    return {
      success: false,
      message: "Arama sorgusu boş.",
      papers: []
    };
  }

  // MultiServerMCPClient — Consensus MCP bağlantısı
  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      consensus: {
        transport: "http",
        url: "https://mcp.consensus.app/mcp",
        headers: {
          Authorization: `Bearer ${process.env.CONSENSUS_API_KEY}`
        }
      }
    }
  });

  let tools;

  try {
    tools = await mcpClient.getTools();
  } catch (err) {
    await mcpClient.close().catch(() => {});
    return {
      success: false,
      message: `MCP bağlantı hatası: ${err.message}`,
      papers: []
    };
  }

  try {
    // createReactAgent — @langchain/langgraph/prebuilt
    // prompt parametresi: SystemMessage objesi (messageModifier deprecated)
    const agent = createReactAgent({
      llm,
      tools,
      prompt: new SystemMessage(academicSearchSystemPrompt)
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          `Şu klinik konu için peer-reviewed literatürü ara ve analiz et: "${query}"

Arama yaparken:
- Önce meta-analiz ve sistematik derlemeleri hedefle
- RCT'leri dahil et
- 2010 sonrası çalışmalara odaklan
- Pediatrik/klinik çalışmaları tercih et
- Sonuçları kanıt düzeyine göre değerlendir ve JSON formatında döndür`
        )
      ]
    });

    const messages = result.messages || [];
    const lastAIMessage = [...messages]
      .reverse()
      .find(m => m._getType?.() === "ai" || m.constructor?.name === "AIMessage");

    const rawContent = lastAIMessage?.content || "";
    const analysis = safeJsonParse(rawContent);

    return {
      success: true,
      query,
      analysis: analysis || { raw: rawContent },
      messageCount: messages.length
    };
  } catch (err) {
    return {
      success: false,
      message: `Agent çalışma hatası: ${err.message}`,
      query,
      papers: []
    };
  } finally {
    await mcpClient.close().catch(() => {});
  }
}

export default { run };