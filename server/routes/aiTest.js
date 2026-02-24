const express = require("express");
const axios = require("axios");
const { env, must } = require("../config/env");

const router = express.Router();

function buildPrompt(context, comment) {
  const trimmedContext = String(context || "").trim();
  const trimmedComment = String(comment || "").trim();
  if (!trimmedContext) {
    return trimmedComment;
  }
  return `Context:\n${trimmedContext}\n\nUser:\n${trimmedComment}`;
}

router.get("/ai-test", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Test</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        padding: 32px;
        background: radial-gradient(circle at top left, #f5f0ff, #f8fafc);
        color: #0f172a;
      }
      .card {
        max-width: 860px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 12px 35px rgba(15, 23, 42, 0.08);
        padding: 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      p {
        margin: 0 0 20px;
        color: #475569;
      }
      label {
        display: block;
        margin-top: 16px;
        font-weight: 600;
      }
      textarea,
      input {
        width: 100%;
        margin-top: 8px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 12px;
        font-size: 14px;
        font-family: inherit;
      }
      textarea {
        min-height: 120px;
        resize: vertical;
      }
      button {
        margin-top: 18px;
        padding: 12px 20px;
        border: none;
        border-radius: 12px;
        background: #1d4ed8;
        color: white;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      pre {
        margin-top: 20px;
        background: #0f172a;
        color: #e2e8f0;
        padding: 16px;
        border-radius: 12px;
        min-height: 120px;
        white-space: pre-wrap;
      }
      .row {
        display: grid;
        gap: 16px;
        grid-template-columns: 1fr 1fr;
      }
      @media (max-width: 760px) {
        .row {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>OpenRouter AI Test</h1>
      <p>Send a context + user message and view the response below.</p>
      <label for="context">Context</label>
      <textarea id="context" placeholder="Add any background context here."></textarea>
      <label for="comment">User Message</label>
      <textarea id="comment" placeholder="Ask something..."></textarea>
      <div class="row">
        <div>
          <label for="model">Model</label>
          <input id="model" placeholder="stepfun/step-3.5-flash:free" />
        </div>
        <div>
          <label for="temperature">Temperature</label>
          <input id="temperature" type="number" step="0.1" min="0" max="2" value="0.7" />
        </div>
      </div>
      <button id="send">Send</button>
      <pre id="output">Waiting for request...</pre>
    </div>
    <script>
      const sendButton = document.getElementById("send");
      const output = document.getElementById("output");
      sendButton.addEventListener("click", async () => {
        const context = document.getElementById("context").value;
        const comment = document.getElementById("comment").value;
        const model = document.getElementById("model").value;
        const temperature = Number(document.getElementById("temperature").value);
        output.textContent = "Sending...";
        sendButton.disabled = true;
        try {
          const response = await fetch("/api/ai-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context, comment, model, temperature }),
          });
          const raw = await response.text();
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (parseError) {
            data = { error: raw || "Invalid JSON response." };
          }
          if (!response.ok) {
            output.textContent = data?.error || "Request failed.";
            return;
          }
          output.textContent = data.content || "(empty response)";
        } catch (error) {
          output.textContent = error?.message || "Request failed.";
        } finally {
          sendButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`);
});

router.post("/api/ai-test", async (req, res) => {
  const { context, comment, model, temperature } = req.body || {};

  if (!comment || !String(comment).trim()) {
    return res.status(400).json({ error: "User message is required." });
  }

  if (!env.openrouterApiKey) {
    return res.status(400).json({
      error: "Missing OPENROUTER_API_KEY in server/.env",
    });
  }

  const apiKey = env.openrouterApiKey;
  const requestModel = String(model || env.openrouterModel || "").trim();
  const resolvedModel = requestModel || "stepfun/step-3.5-flash:free";

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (env.openrouterSiteUrl) {
    headers["HTTP-Referer"] = env.openrouterSiteUrl;
  }
  if (env.openrouterSiteName) {
    headers["X-Title"] = env.openrouterSiteName;
  }

  const prompt = buildPrompt(context, comment);

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: resolvedModel,
        messages: [{ role: "user", content: prompt }],
        temperature:
          typeof temperature === "number" && !Number.isNaN(temperature)
            ? temperature
            : 0.7,
      },
      { headers, timeout: 30000 }
    );

    const content = response?.data?.choices?.[0]?.message?.content || "";
    console.log("AI Test response:", content);
    return res.json({ ok: true, content, raw: response.data });
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const code = error?.code;
    const message =
      data?.error?.message ||
      data?.message ||
      error?.message ||
      "OpenRouter request failed.";
    console.error("AI Test error:", {
      message,
      status,
      code,
      data,
    });
    return res.status(500).json({
      error: message,
      status,
      code,
      details: data,
    });
  }
});

module.exports = router;
