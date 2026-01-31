const axios = require("axios");
const { redactToken } = require("../utils/helpers");

async function replyToComment({ commentId, message, accessToken }) {
    console.log(`Replying to comment: ${commentId}`);
    console.log(`Using access token: ${redactToken(accessToken)}`);
    const fbGraphVersion = process.env.FB_GRAPH_VERSION || "v19.0";
    const urls = [
        `https://graph.facebook.com/${fbGraphVersion}/${commentId}/replies`,
        `https://graph.instagram.com/${commentId}/replies`,
    ];
    try {
        let lastErr = null;
        for (const url of urls) {
            try {
                console.log(`POST ${url} message="${String(message || "").slice(0, 200)}"`);
                await axios.post(url, null, { params: { message, access_token: accessToken } });
                console.log("Successfully posted reply to Instagram.");
                return;
            } catch (e) {
                lastErr = e;
                console.error("Reply attempt failed:", url, e?.response?.data || e.message);
            }
        }
        throw lastErr || new Error("All reply attempts failed");
    } catch (e) {
        console.error("Failed to post reply to Instagram:", e?.response?.data || e.message);
        throw e; // re-throw to be caught by webhook handler
    }
}

module.exports = { replyToComment };
