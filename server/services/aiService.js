const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateReply(comment, context) {
    console.log("Generating AI reply...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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

module.exports = { generateReply };
