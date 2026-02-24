import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Missing OPENROUTER_API_KEY in ai/.env");
  process.exit(1);
}

const siteUrl = process.env.OPENROUTER_SITE_URL;
const siteName = process.env.OPENROUTER_SITE_NAME;
const model =
  process.env.OPENROUTER_MODEL || "stepfun/step-3.5-flash:free";

const openrouter = new OpenRouter({
  apiKey,
  ...(siteUrl ? { httpReferer: siteUrl } : {}),
  ...(siteName ? { xTitle: siteName } : {}),
});

async function main() {
  const stream = await openrouter.chat.send({
    chatGenerationParams: {
      model,
      messages: [
        {
          role: "user",
          content: "What is the meaning of life?",
        },
      ],
      stream: true,
    },
  });

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }
}

main().catch((error) => {
  console.error("OpenRouter request failed:", error?.message || error);
  process.exit(1);
});
