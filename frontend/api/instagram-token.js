/* eslint-env node */
/* global process */
// Vercel serverless function to exchange an Instagram authorization code for a short-lived token.
// Keep INSTAGRAM_APP_SECRET (and optional INSTAGRAM_APP_ID) in project env vars; never expose them in the client.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, redirect_uri: redirectUri, client_id: clientIdFromBody } = req.body || {}
  const clientId = process.env.INSTAGRAM_APP_ID || clientIdFromBody
  const clientSecret = process.env.INSTAGRAM_APP_SECRET || process.env.APP_SECRET

  if (!clientSecret) {
    return res.status(500).json({ error: 'Missing INSTAGRAM_APP_SECRET on the server.' })
  }

  if (!clientId || !code || !redirectUri) {
    return res.status(400).json({ error: 'Missing client_id, code, or redirect_uri.' })
  }

  try {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    })

    const igResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
    })

    const text = await igResponse.text()
    if (!igResponse.ok) {
      return res.status(igResponse.status).send(text || 'Token exchange failed')
    }

    const json = JSON.parse(text)
    if (!json.access_token || !json.user_id) {
      return res.status(502).json({ error: 'Token endpoint did not return access_token and user_id.' })
    }

    return res.status(200).json(json)
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error during token exchange.' })
  }
}
