const { GoogleGenerativeAI } = require("@google/generative-ai");
const { env, must } = require("../config/env");

let genAI = null;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(must(env.geminiApiKey, "GEMINI_API_KEY"));
  }
  return genAI;
}

async function generateReply(comment, context) {
  console.log("Generating AI reply...");
  try {
    const model = getClient().getGenerativeModel({ model: env.geminiModel });
    const prompt = `
You are a friendly customer support agent for Rumo Restaurant.
Rules:
- Answer ONLY using the provided context.
- If the answer isn't in the context, be polite but do not invent details, use few words from context if possible.
- Return EXACTLY ONE sentence.
- User Comment: "${comment}"
- Context: "${context}"
`;
    const result = await model.generateContent(prompt);
    const replyText = result.response.text().trim();
    console.log(`Generated reply: "${replyText}"`);
    return replyText;
  } catch (e) {
    console.error("AI reply generation failed:", e.message);
    return "Thank you for reaching out! 😊";
  }
}

module.exports = {
  generateReply,
};
