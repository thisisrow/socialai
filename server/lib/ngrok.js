const { env } = require("../config/env");

let listener = null;

/**
 * Open a public HTTPS tunnel to the local API when NGROK_ENABLED=true.
 * Failures are logged, never fatal - the API keeps serving locally.
 */
async function startNgrok() {
  if (!env.ngrokEnabled) return null;
  if (!env.ngrokAuthtoken) {
    console.warn("[ngrok] NGROK_ENABLED=true but NGROK_AUTHTOKEN is not set - tunnel skipped.");
    return null;
  }

  try {
    const ngrok = require("@ngrok/ngrok");
    listener = await ngrok.forward({
      addr: env.port,
      authtoken: env.ngrokAuthtoken,
      ...(env.ngrokDomain ? { domain: env.ngrokDomain } : {}),
    });
    const url = listener.url();
    console.log(`[ngrok] tunnel open: ${url} -> :${env.port}`);
    console.log(`[ngrok] Instagram webhook callback: ${url}/api/webhook`);
    return url;
  } catch (e) {
    console.error("[ngrok] failed to open tunnel:", e.message);
    return null;
  }
}

async function stopNgrok() {
  if (!listener) return;
  await listener.close().catch(() => {});
  listener = null;
}

module.exports = { startNgrok, stopNgrok };
