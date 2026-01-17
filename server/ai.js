const { GoogleGenAI } = require("@google/genai");

// Best practice: Use environment variables for your key
const apiKey = "AIzaSyCTyAsR5dPHYoHPMBysZI5ZZQXZFhHcOTg";
const ai = new GoogleGenAI({ apiKey });

async function runPrompt() {
  try {
    // Access the specific model
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Write a short poem about the sea in English. of 4 line",
    });

    console.log("Gemini Response:", response.text);
  } catch (error) {
    console.error("Error connecting to Gemini:", error);
  }
}

runPrompt();