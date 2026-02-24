const axios = require("axios");
const { env } = require("../config/env");

function buildPrompt(comment, context) {
  return `
You are a friendly customer support agent for Rumo Restaurant.
Rules:
- Answer ONLY using the provided context.
- If the answer isn't in the context, be polite but do not invent details, use few words from context if possible.
- Return EXACTLY ONE sentence.
- User Comment: "${comment}"
- Context: "${context}"
`;
}

function buildHeaders() {
  const headers = {
    Authorization: `Bearer ${env.openrouterApiKey}`,
    "Content-Type": "application/json",
  };
  if (env.openrouterSiteUrl) headers["HTTP-Referer"] = env.openrouterSiteUrl;
  if (env.openrouterSiteName) headers["X-Title"] = env.openrouterSiteName;
  return headers;
}

async function callOpenRouter({ model, prompt }) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    },
    { headers: buildHeaders(), timeout: 30000 }
  );
  const replyText =
    response?.data?.choices?.[0]?.message?.content?.trim() || "";
  return { replyText, raw: response?.data };
}

async function generateReply(comment, context) {
  console.log("Generating AI reply...");
  if (!env.openrouterApiKey) {
    console.error("Missing OPENROUTER_API_KEY");
    return "Thank you for reaching out! 😊";
  }

  const prompt = buildPrompt(comment, context);
  const primaryModel = env.openrouterModel || "stepfun/step-3.5-flash:free";
  const fallbackModel = "deepseek/deepseek-r1-0528:free";

  try {
    const { replyText } = await callOpenRouter({
      model: primaryModel,
      prompt,
    });
    console.log(`Generated reply (${primaryModel}): "${replyText}"`);
    return replyText || "Thank you for reaching out! 😊";
  } catch (e) {
    const message =
      e?.response?.data?.error?.message ||
      e?.response?.data?.message ||
      e?.message;
    const status = e?.response?.status;
    console.error("AI reply generation failed:", {
      model: primaryModel,
      status,
      message,
      details: e?.response?.data,
    });

    // If OpenRouter rejects this model or user, try fallback once.
    if (primaryModel !== fallbackModel) {
      try {
        const { replyText } = await callOpenRouter({
          model: fallbackModel,
          prompt,
        });
        console.log(`Generated reply (${fallbackModel}): "${replyText}"`);
        return replyText || "Thank you for reaching out! 😊";
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError?.response?.data?.error?.message ||
          fallbackError?.response?.data?.message ||
          fallbackError?.message;
        console.error("AI fallback failed:", {
          model: fallbackModel,
          status: fallbackError?.response?.status,
          message: fallbackMessage,
          details: fallbackError?.response?.data,
        });
      }
    }

    return "Thank you for reaching out! 😊";
  }
}

module.exports = {
  generateReply,
};
