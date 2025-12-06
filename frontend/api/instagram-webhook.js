/* eslint-env node */
/* global process */
// Instagram Webhook endpoint (Vercel serverless).
// Use for webhook verification (GET) and to receive comment notifications (POST).
// Set WEBHOOK_VERIFY_TOKEN in your Vercel environment and reuse the same value in Meta's dashboard.
// Optional: set IG_WEBHOOK_GRAPH_TOKEN to a long-lived Instagram User token with instagram_business_manage_comments
// to fetch comment details after receiving a notification (handy for debugging).

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token && challenge && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge)
    }

    return res.status(403).send('Verification failed')
  }

  if (req.method === 'POST') {
    try {
      // Meta sends JSON; Vercel will parse it when content-type is application/json.
      const payload = req.body
      console.log('Received IG webhook:', JSON.stringify(payload))

      // Optionally fetch comment detail for debugging.
      const graphToken = process.env.IG_WEBHOOK_GRAPH_TOKEN
      const change = payload?.entry?.[0]?.changes?.[0]
      const commentId = change?.value?.id

      if (graphToken && commentId) {
        const params = new URLSearchParams({ fields: 'id,text,username,like_count,timestamp', access_token: graphToken })
        const url = `https://graph.facebook.com/v19.0/${commentId}?${params.toString()}`
        try {
          const resp = await fetch(url)
          const txt = await resp.text()
          console.log('Fetched comment detail:', txt)
        } catch (err) {
          console.error('Failed to fetch comment detail', err)
        }
      }

      return res.status(200).json({ received: true })
    } catch (err) {
      console.error('Error handling IG webhook', err)
      return res.status(500).json({ error: 'Failed to process webhook' })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
