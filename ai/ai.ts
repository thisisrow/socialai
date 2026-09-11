/**
 * Claude API smoke test.
 *
 * Purpose: prove ANTHROPIC_API_KEY + CLAUDE_MODEL work before the server relies
 * on them. Runs in two stages so a failure tells you *which* thing is wrong:
 *
 *   Stage 1  models.list()  - costs nothing, so it isolates "is the key valid"
 *   Stage 2  messages       - the real thing, needs credits
 *
 * Run:  cd ai && npm install && npm start
 */
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("\nMissing ANTHROPIC_API_KEY in ai/.env (copy ai/.env.example).\n");
  process.exit(1);
}

const model = process.env.CLAUDE_MODEL || "claude-opus-5";
const client = new Anthropic({ apiKey });

const line = (s = "") => console.log(s);
const isCreditError = (e: unknown) =>
  e instanceof Anthropic.APIError && String(e.message).includes("credit balance is too low");

/** Stage 1: does the key authenticate, and can it see the model we want? */
async function checkKey(): Promise<boolean> {
  line(`[1/3] Checking the API key`);
  try {
    const models = await client.models.list({ limit: 20 });
    const ids = models.data.map((m) => m.id);
    line(`      Key is VALID.`);
    line(`      Models available: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", ..." : ""}`);

    if (!ids.includes(model)) {
      line(`      WARNING: "${model}" is not in the list. Set CLAUDE_MODEL to one of the above.`);
    }
    return true;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      line(`      Key is INVALID (401). It has been revoked, or it is mistyped.`);
      line(`      Get a new one at https://console.anthropic.com/settings/keys`);
    } else if (e instanceof Anthropic.PermissionDeniedError) {
      line(`      Key authenticates but lacks permission (403). Check its scopes.`);
    } else {
      line(`      Could not reach the API: ${(e as Error)?.message}`);
    }
    return false;
  }
}

/** Stage 2: a plain request. This is the first step that spends credits. */
async function plainCall() {
  line();
  line(`[2/3] Plain request (model: ${model})`);
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: "Reply in one short sentence.",
    messages: [{ role: "user", content: "Say hello and confirm the API key works." }],
  });

  for (const block of response.content) {
    if (block.type === "text") line(`      -> ${block.text.trim()}`);
  }
  line(
    `      usage: in=${response.usage.input_tokens} out=${response.usage.output_tokens} stop=${response.stop_reason}`,
  );
}

/** Stage 3: the exact shape server/services/ai.js uses for a real comment. */
async function replyCall() {
  line();
  line(`[3/3] Comment-reply shape (what the server actually sends)`);
  const context = "Rumo Restaurant opens 11am-11pm daily. We do takeaway but no delivery.";
  const comment = "hey do you guys deliver?";

  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: "You reply to Instagram comments for a small business. One sentence. Only use the given context.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: `Context:\n${context}\n\nComment from @guest:\n${comment}` }],
  });

  process.stdout.write("      -> ");
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  line();
  line(`      usage: in=${final.usage.input_tokens} out=${final.usage.output_tokens}`);
}

async function main() {
  line();
  const keyOk = await checkKey();
  if (!keyOk) {
    line();
    line("RESULT: the API key is not usable. Nothing else was attempted.");
    line();
    // exitCode rather than exit(): lets open handles unwind cleanly on Windows.
    process.exitCode = 1;
    return;
  }

  try {
    await plainCall();
    await replyCall();
    line();
    line("RESULT: everything works. The key is valid and requests are going through.");
    line();
  } catch (e) {
    line();
    if (isCreditError(e)) {
      line("RESULT: your API KEY IS FINE, but the account has no credits.");
      line("        Every request returns 400 until you top up.");
      line("        Add credits at https://console.anthropic.com/settings/billing");
    } else if (e instanceof Anthropic.RateLimitError) {
      line("RESULT: the key works, but you are rate limited (429). Retry in a moment.");
    } else if (e instanceof Anthropic.NotFoundError) {
      line(`RESULT: model "${model}" is not available to this key.`);
      line("        Set CLAUDE_MODEL to one of the models listed in step 1.");
    } else if (e instanceof Anthropic.APIError) {
      line(`RESULT: API error ${e.status}: ${e.message}`);
    } else {
      line(`RESULT: ${(e as Error)?.message || e}`);
    }
    line();
    process.exitCode = 1;
  }
}

main();
