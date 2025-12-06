import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const APP_ID = '1251511386469731'
const REDIRECT_URI = 'https://socialai-theta.vercel.app/'
const APP_SECRET = import.meta.env.VITE_IG_APP_SECRET
const TOKEN_ENDPOINT = import.meta.env.VITE_IG_TOKEN_ENDPOINT || '/api/instagram-token' // server-side endpoint to avoid CORS

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
  const isBasicDisplayToken = useMemo(() => accessToken?.startsWith('IG'), [accessToken])

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
      const usingBasicToken = token.startsWith('IG') || isBasicDisplayToken
      setStatus(
        usingBasicToken
          ? 'Fetching media via graph.instagram.com (comments are not available with this token)...'
          : 'Fetching media and comments...',
      )
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

      const basicDisplayFields = ['id', 'caption', 'media_type', 'media_url', 'permalink', 'thumbnail_url', 'timestamp', 'username']

      const params = new URLSearchParams({
        fields: (usingBasicToken ? basicDisplayFields : fields).join(','),
        access_token: token,
      })

      const baseUrl = usingBasicToken ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v19.0'
      const path = usingBasicToken ? 'me/media' : `${igUserId}/media`
      const url = `${baseUrl}/${path}?${params.toString()}`
      const response = await fetch(url)

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to load media')
      }

      const data = await response.json()
      setMedia(data?.data || [])
      setStatus(usingBasicToken ? 'Connected (basic token: comments unavailable)' : 'Connected')
    } catch (err) {
      setError(err?.message || 'Unable to load posts.')
      setStatus('')
    }
  }, [isBasicDisplayToken])

  const handleLogout = () => {
    localStorage.removeItem('ig_access_token')
    localStorage.removeItem('ig_user_id')
    setAccessToken('')
    setUserId('')
    setMedia([])
    setStatus('Logged out. Connect again to reload data.')
  }

  const exchangeCodeForToken = useCallback(async (code) => {
    try {
      setError('')

      const body = new URLSearchParams({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        code,
      })

      let url = 'https://api.instagram.com/oauth/access_token'

      if (TOKEN_ENDPOINT) {
        // Prefer your own serverless endpoint to avoid CORS with api.instagram.com
        url = TOKEN_ENDPOINT
      } else if (APP_SECRET) {
        body.append('client_secret', APP_SECRET)
        body.append('grant_type', 'authorization_code')
      } else {
        setError(
          'Set VITE_IG_TOKEN_ENDPOINT to a server-side token exchange endpoint (recommended) or VITE_IG_APP_SECRET for local dev.',
        )
        setStatus('')
        return
      }

      if (!body.get('grant_type')) {
        body.append('grant_type', 'authorization_code')
      }

      const response = await fetch(url, {
        method: 'POST',
        body,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Token exchange failed')
      }

      const data = await response.json()
      if (!data.access_token || !data.user_id) {
        throw new Error('Token endpoint did not return access_token and user_id.')
      }

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
      setStatus('Restored session. Loading posts...')
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
        <div className="header-actions">
          <button className="primary-btn" type="button" onClick={() => window.open(loginUrl, '_self')}>
            Connect account
          </button>
          {accessToken && (
            <button className="ghost-btn" type="button" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
      </header>

      <section className="status-bar">
        {status && <div className="status-chip">{status}</div>}
        {error && <div className="error-chip">Error: {error}</div>}
        {!status && !error && !accessToken && <div className="status-chip muted">Waiting for login...</div>}
        {!status && accessToken && !error && <div className="status-chip">Connected</div>}
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
              {isBasicDisplayToken ? (
                <p className="muted small">Comments are not returned with this (Basic Display) token.</p>
              ) : item.comments?.data?.length ? (
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
