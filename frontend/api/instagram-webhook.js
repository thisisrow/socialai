/* eslint-env node */
/* global process */
// Instagram Webhook endpoint (Vercel serverless).
// Use for webhook verification (GET) and to receive comment notifications (POST).
// Set WEBHOOK_VERIFY_TOKEN in your Vercel environment and reuse the same value in Meta's dashboard.

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
      return res.status(200).json({ received: true })
    } catch (err) {
      console.error('Error handling IG webhook', err)
      return res.status(500).json({ error: 'Failed to process webhook' })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
