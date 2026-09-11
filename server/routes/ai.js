const express = require("express");
const { AiSettings, logActivity } = require("../models");
const { env } = require("../config/env");
const { requireAuth } = require("../middleware/requireAuth");
const { rateLimit } = require("../middleware/rateLimit");
const { asyncHandler } = require("../lib/errors");
const { optionalString, requireString, oneOf, clampInt } = require("../lib/validate");
const { generateReply, testConnection, DEFAULT_SETTINGS } = require("../services/ai");

const router = express.Router();

router.use(requireAuth);

const TONES = ["friendly", "professional", "playful", "concise", "enthusiastic"];

const publicSettings = (doc) => ({
  businessName: doc.businessName || "",
  businessDescription: doc.businessDescription || "",
  tone: doc.tone || "friendly",
  language: doc.language || "English",
  signature: doc.signature || "",
  maxSentences: doc.maxSentences ?? 1,
  useEmojis: doc.useEmojis ?? true,
  fallbackMessage: doc.fallbackMessage || DEFAULT_SETTINGS.fallbackMessage,
  customInstructions: doc.customInstructions || "",
  globalContext: doc.globalContext || "",
  autoReplyByDefault: Boolean(doc.autoReplyByDefault),
});

// ----------------------------------------------------------- settings ---
router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    // Upsert rather than 404: a signed-in user always has settings.
    const doc = await AiSettings.findOneAndUpdate(
      { userId: req.userId },
      { $setOnInsert: { userId: req.userId } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    res.json({
      settings: publicSettings(doc),
      model: env.claudeModel,
      configured: Boolean(env.anthropicApiKey),
      tones: TONES,
    });
  }),
);

router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const update = {};

    if (body.businessName !== undefined)
      update.businessName = optionalString(body.businessName, "businessName", { max: 120 });
    if (body.businessDescription !== undefined)
      update.businessDescription = optionalString(body.businessDescription, "businessDescription", {
        max: 2000,
      });
    if (body.tone !== undefined) update.tone = oneOf(body.tone, "tone", TONES, "friendly");
    if (body.language !== undefined)
      update.language = optionalString(body.language, "language", { max: 40 }) || "English";
    if (body.signature !== undefined)
      update.signature = optionalString(body.signature, "signature", { max: 120 });
    if (body.maxSentences !== undefined)
      update.maxSentences = clampInt(body.maxSentences, "maxSentences", { min: 1, max: 4, fallback: 1 });
    if (body.useEmojis !== undefined) update.useEmojis = Boolean(body.useEmojis);
    if (body.fallbackMessage !== undefined)
      update.fallbackMessage =
        optionalString(body.fallbackMessage, "fallbackMessage", { max: 300 }) ||
        DEFAULT_SETTINGS.fallbackMessage;
    if (body.customInstructions !== undefined)
      update.customInstructions = optionalString(body.customInstructions, "customInstructions", {
        max: 2000,
      });
    if (body.globalContext !== undefined)
      update.globalContext = optionalString(body.globalContext, "globalContext", { max: 4000 });
    if (body.autoReplyByDefault !== undefined)
      update.autoReplyByDefault = Boolean(body.autoReplyByDefault);

    const doc = await AiSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: update, $setOnInsert: { userId: req.userId } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );

    logActivity(req.userId, "settings.updated", "AI settings updated");
    res.json({ settings: publicSettings(doc) });
  }),
);

// ------------------------------------------------------------ preview ---
const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "ai-preview",
  message: "Slow down - too many preview requests.",
});

/** Dry run against the user's real settings. Nothing is posted to Instagram. */
router.post(
  "/preview",
  previewLimiter,
  asyncHandler(async (req, res) => {
    const comment = requireString(req.body?.comment, "comment", { max: 1000 });
    const context = optionalString(req.body?.context, "context", { max: 4000 });
    const username = optionalString(req.body?.username, "username", { max: 60 }) || "customer";

    const started = Date.now();
    const result = await generateReply({ userId: req.userId, comment, context, username });

    res.json({
      ok: result.ok,
      reply: result.text,
      error: result.error || null,
      code: result.code || null,
      model: result.model || env.claudeModel,
      usage: result.usage || null,
      latencyMs: Date.now() - started,
    });
  }),
);

// --------------------------------------------------------------- test ---
router.post(
  "/test",
  previewLimiter,
  asyncHandler(async (req, res) => {
    res.json(await testConnection());
  }),
);

module.exports = router;
