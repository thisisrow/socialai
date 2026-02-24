const axios = require("axios");
const { env } = require("../config/env");

async function generateReply(comment, context) {
  console.log("Generating AI reply...");
  try {
    if (!env.openrouterApiKey) {
      console.error("Missing OPENROUTER_API_KEY");
      return "Thank you for reaching out! 😊";
    }

    const prompt = `
You are a friendly customer support agent for Rumo Restaurant.
Rules:
- Answer ONLY using the provided context.
- If the answer isn't in the context, be polite but do not invent details, use few words from context if possible.
- Return EXACTLY ONE sentence.
- User Comment: "${comment}"
- Context: "${context}"
`;

    const headers = {
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
    };
    if (env.openrouterSiteUrl) headers["HTTP-Referer"] = env.openrouterSiteUrl;
    if (env.openrouterSiteName) headers["X-Title"] = env.openrouterSiteName;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: env.openrouterModel || "stepfun/step-3.5-flash:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      },
      { headers, timeout: 30000 }
    );

    const replyText =
      response?.data?.choices?.[0]?.message?.content?.trim() || "";
    console.log(`Generated reply: "${replyText}"`);
    return replyText || "Thank you for reaching out! 😊";
  } catch (e) {
    const message =
      e?.response?.data?.error?.message ||
      e?.response?.data?.message ||
      e?.message;
    console.error("AI reply generation failed:", message);
    return "Thank you for reaching out! 😊";
  }
}

module.exports = {
  generateReply,
};
