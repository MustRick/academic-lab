import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import {
  reviewerSystemPrompt,
  reviewerAnalysisPrompt
} from "./prompts/reviewer.prompt.js";

// DeepSeek v4 flash
const llm = new ChatOpenAI({
  model: "deepseek-v4-flash",
  temperature: 0.2,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL
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
  const editorMail =
    typeof input === "string"
      ? input
      : input.editorMail ||
        input.reviewerMail ||
        input.email ||
        input.text ||
        input.message ||
        "";

  if (!editorMail) {
    return {
      success: false,
      message: "Editör/reviewer mail içeriği boş.",
      todoList: []
    };
  }

  try {
    const response = await llm.invoke([
      new SystemMessage(reviewerSystemPrompt),
      new HumanMessage(
        reviewerAnalysisPrompt({
          editorMail
        })
      )
    ]);

    const rawContent = response.content || "";
    const analysis = safeJsonParse(rawContent);

    return {
      success: true,
      agent: "reviewer.agent.js",
      inputType: "editor_or_reviewer_email",
      analysis: analysis || { raw: rawContent }
    };
  } catch (err) {
    return {
      success: false,
      message: `Reviewer agent çalışma hatası: ${err.message}`,
      todoList: []
    };
  }
}

export default { run };