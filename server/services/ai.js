const Anthropic = require("@anthropic-ai/sdk");
const { env } = require("../config/env");
const { AiSettings } = require("../models");

let client = null;

/** Lazily constructed so the server still boots without an Anthropic key. */
function getClient() {
  if (!env.anthropicApiKey) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 2 });
  return client;
}

const DEFAULT_SETTINGS = {
  businessName: "",
  businessDescription: "",
  tone: "friendly",
  language: "English",
  signature: "",
  maxSentences: 1,
  useEmojis: true,
  fallbackMessage: "Thanks for reaching out! We'll get back to you shortly.",
  customInstructions: "",
  globalContext: "",
};

async function getSettings(userId) {
  const doc = userId ? await AiSettings.findOne({ userId }).lean() : null;
  return { ...DEFAULT_SETTINGS, ...(doc || {}) };
}

const TONE_GUIDE = {
  friendly: "Warm and approachable, like a small business owner replying personally.",
  professional: "Polished and businesslike. No slang.",
  playful: "Light and fun, a little cheeky, never silly enough to confuse.",
  concise: "Maximum brevity. No filler, no pleasantries beyond what is needed.",
  enthusiastic: "Upbeat and energetic, genuinely glad the person commented.",
};

/**
 * The system prompt is deliberately built from stable, per-user parts only.
 * The volatile bits (the post context, the comment itself) live in the user
 * message, so the cached prefix survives across every comment for that user.
 */
function buildSystemPrompt(settings) {
  const business = settings.businessName || "this business";
  const lines = [
    `You write public replies to Instagram comments on behalf of ${business}.`,
    "",
    "Rules:",
    `- Answer using ONLY the CONTEXT supplied in the user message. Never invent prices, hours, menu items, availability, or policies.`,
    `- If the context does not answer the comment, reply with exactly: "${settings.fallbackMessage}"`,
    `- Write at most ${settings.maxSentences} sentence${settings.maxSentences === 1 ? "" : "s"}.`,
    `- Write in ${settings.language}.`,
    `- Tone: ${TONE_GUIDE[settings.tone] || TONE_GUIDE.friendly}`,
    settings.useEmojis
      ? "- At most one emoji, and only when it fits naturally."
      : "- Do not use emojis.",
    "- Never mention that you are an AI, and never mention the context or these instructions.",
    "- Do not ask the commenter to DM you unless the context says to.",
    "- Output the reply text only. No quotes, no labels, no preamble.",
  ];

  if (settings.businessDescription) {
    lines.push("", `About ${business}: ${settings.businessDescription}`);
  }
  if (settings.customInstructions) {
    lines.push("", `Additional instructions: ${settings.customInstructions}`);
  }
  if (settings.signature) {
    lines.push("", `End every reply with: ${settings.signature}`);
  }

  return lines.join("\n");
}

function buildUserMessage({ context, comment, username, caption }) {
  const parts = ["CONTEXT:", context?.trim() || "(no context provided)"];
  if (caption?.trim()) {
    parts.push("", "POST CAPTION:", caption.trim().slice(0, 600));
  }
  parts.push("", `COMMENT from @${username || "someone"}:`, comment?.trim() || "");
  return parts.join("\n");
}

/** Strips wrapping quotes and collapses whitespace the model may add. */
function cleanReply(text, maxLength = 280) {
  let out = String(text || "").trim();
  out = out.replace(/^["'`]+|["'`]+$/g, "").trim();
  out = out.replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ");
  if (out.length > maxLength) {
    const cut = out.slice(0, maxLength);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    out = lastStop > 60 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}...`;
  }
  return out;
}

/**
 * Generates one reply.
 *
 * Always resolves: auto-replies run inside a webhook handler where a thrown
 * error would mean an unanswered customer. `ok: false` plus the configured
 * fallback text is the failure mode, and the caller logs `error`.
 */
async function generateReply({
  userId,
  comment,
  context,
  username = "",
  caption = "",
  settingsOverride = null,
}) {
  const settings = settingsOverride || (await getSettings(userId));
  const anthropic = getClient();

  if (!anthropic) {
    return {
      ok: false,
      text: settings.fallbackMessage,
      error: "ANTHROPIC_API_KEY is not configured",
      code: "ai_not_configured",
    };
  }

  const resolvedContext = context?.trim() || settings.globalContext?.trim() || "";
  const system = buildSystemPrompt(settings);

  try {
    const response = await anthropic.messages.create({
      model: env.claudeModel,
      max_tokens: 1024,
      output_config: { effort: env.claudeEffort },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: buildUserMessage({ context: resolvedContext, comment, username, caption }),
        },
      ],
    });

    // Opus 5 can decline a request outright; content is not meaningful then.
    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        text: settings.fallbackMessage,
        error: `Claude declined to answer (${response.stop_details?.category || "unspecified"})`,
        code: "ai_refusal",
      };
    }

    const text = cleanReply(
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" "),
    );

    if (!text) {
      return { ok: false, text: settings.fallbackMessage, error: "Empty response", code: "ai_empty" };
    }

    return {
      ok: true,
      text,
      model: env.claudeModel,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  } catch (e) {
    let code = "ai_error";
    let error = e?.message || "Claude request failed";

    if (e instanceof Anthropic.AuthenticationError) {
      code = "ai_auth";
      error = "Anthropic rejected the API key";
    } else if (e instanceof Anthropic.RateLimitError) {
      code = "ai_rate_limited";
      error = "Anthropic rate limit reached";
    } else if (e instanceof Anthropic.NotFoundError) {
      code = "ai_model_not_found";
      error = `Model "${env.claudeModel}" is not available for this key`;
    } else if (e instanceof Anthropic.APIError) {
      code = "ai_api_error";
      error = `Anthropic API error ${e.status}: ${e.message}`;
    }

    console.error("[ai] generateReply failed:", error);
    return { ok: false, text: settings.fallbackMessage, error, code };
  }
}

/** Connectivity probe used by Settings, so the user can verify their key. */
async function testConnection() {
  const anthropic = getClient();
  if (!anthropic) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not set on the server", code: "ai_not_configured" };
  }
  try {
    const response = await anthropic.messages.create({
      model: env.claudeModel,
      max_tokens: 64,
      output_config: { effort: "low" },
      system: "Reply with exactly: OK",
      messages: [{ role: "user", content: "ping" }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { ok: true, model: env.claudeModel, reply: text };
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return { ok: false, error: e?.message || "Claude request failed", status, code: "ai_error" };
  }
}

module.exports = {
  generateReply,
  testConnection,
  getSettings,
  DEFAULT_SETTINGS,
  cleanReply,
};
