import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const APP_ID = '1251511386469731'
const REDIRECT_URI = 'https://socialai-theta.vercel.app/'
const APP_SECRET = 'c0f05657a7ed375ed614576e9c467fd8'

const scopes = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
]

function App() {
  const [authCode, setAuthCode] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [userId, setUserId] = useState('')
  const [media, setMedia] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const loginUrl = useMemo(() => {
    const params = new URLSearchParams({
      force_reauth: 'true',
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(','),
    })
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const incomingCode = params.get('code')
    if (incomingCode) {
      // Instagram appends #_ at the end, strip it if present.
      const cleaned = incomingCode.replace(/#_$/, '')
      setAuthCode(cleaned)
      setStatus('Authorization code received. Exchanging for access token...')
    }
  }, [])

  const fetchMedia = useCallback(async (igUserId, token) => {
    try {
      setStatus('Fetching media and comments...')
      setError('')

      const fields = [
        'id',
        'caption',
        'media_type',
        'media_url',
        'permalink',
        'thumbnail_url',
        'timestamp',
        'comments.limit(5){id,text,username,timestamp}',
      ]

      const url = `https://graph.facebook.com/v19.0/${igUserId}/media?fields=${fields.join(',')}&access_token=${token}`
      const response = await fetch(url)

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to load media')
      }

      const data = await response.json()
      setMedia(data?.data || [])
      setStatus('')
    } catch (err) {
      setError(err?.message || 'Unable to load posts.')
      setStatus('')
    }
  }, [])

  const exchangeCodeForToken = useCallback(async (code) => {
    if (!APP_SECRET) {
      setError('Add VITE_IG_APP_SECRET to your environment (server-side recommended) to exchange the code for a token.')
      setStatus('')
      return
    }

    try {
      setError('')
      const body = new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      })

      const response = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Token exchange failed')
      }

      const data = await response.json()
      setAccessToken(data.access_token)
      setUserId(String(data.user_id))
      localStorage.setItem('ig_access_token', data.access_token)
      localStorage.setItem('ig_user_id', String(data.user_id))
      setStatus('Access token received. Loading recent posts...')
      fetchMedia(data.user_id, data.access_token)
    } catch (err) {
      setError(err?.message || 'Something went wrong while exchanging the code.')
      setStatus('')
    }
  }, [fetchMedia])

  useEffect(() => {
    if (!authCode) return
    exchangeCodeForToken(authCode)
  }, [authCode, exchangeCodeForToken])

  useEffect(() => {
    // Restore from localStorage to avoid re-authenticating on refresh while the token is valid.
    const storedToken = localStorage.getItem('ig_access_token')
    const storedUserId = localStorage.getItem('ig_user_id')
    if (storedToken && storedUserId && !accessToken) {
      setAccessToken(storedToken)
      setUserId(storedUserId)
      fetchMedia(storedUserId, storedToken)
    }
  }, [accessToken, fetchMedia])

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Instagram Business Login</h1>
          <p className="subtitle">
            Connect your Instagram professional account, then we’ll pull a few posts and their recent comments as JSON for inspection.
          </p>
        </div>
        <button className="primary-btn" type="button" onClick={() => window.open(loginUrl, '_self')}>
          Connect account
        </button>
      </header>

      <section className="status-bar">
        {status && <div className="status-chip">{status}</div>}
        {error && <div className="error-chip">Error: {error}</div>}
        {!status && !error && <div className="status-chip muted">Waiting for login...</div>}
      </section>

      <section className="token-box">
        <h2>Auth details</h2>
        <div className="token-grid">
          <div>
            <p className="label">Authorization code</p>
            <code className="code-block">{authCode || 'Not received yet'}</code>
          </div>
          <div>
            <p className="label">Access token (short-lived)</p>
            <code className="code-block">{accessToken || 'No token yet'}</code>
            <p className="note">Never expose your app secret in production. Move token exchange to a server.</p>
          </div>
          <div>
            <p className="label">Instagram user id</p>
            <code className="code-block">{userId || 'Unknown'}</code>
          </div>
        </div>
      </section>

      <section className="posts">
        <div className="posts-header">
          <h2>Recent posts</h2>
          {accessToken && userId && (
            <button className="ghost-btn" type="button" onClick={() => fetchMedia(userId, accessToken)}>
              Refresh
            </button>
          )}
        </div>

        {!media.length && <p className="muted">No posts loaded yet. Connect your account to see data.</p>}

        <div className="media-grid">
          {media.map((item) => (
            <article key={item.id} className="card">
              <div className="card-top">
                <p className="label">{item.media_type}</p>
                <a href={item.permalink} target="_blank" rel="noreferrer">
                  View on Instagram
                </a>
              </div>
              <p className="caption">{item.caption || 'No caption'}</p>
              {item.media_url && <img className="media-img" src={item.media_url} alt={item.caption || 'Instagram media'} />}
              <p className="timestamp">{item.timestamp}</p>
              {item.comments?.data?.length ? (
                <div className="comments">
                  <p className="label">Recent comments</p>
                  <ul>
                    {item.comments.data.map((comment) => (
                      <li key={comment.id}>
                        <span className="comment-user">{comment.username}</span>: {comment.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="muted small">No comments fetched.</p>
              )}
            </article>
          ))}
        </div>

        {!!media.length && (
          <details className="json-dump">
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(media, null, 2)}</pre>
          </details>
        )}
      </section>
    </main>
  )
}

export default App
