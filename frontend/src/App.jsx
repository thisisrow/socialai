/* ========================= FRONTEND (React / Vite) =========================
   Changes from your current frontend:
   - Remove direct calls to graph.instagram.com / graph.facebook.com to fetch posts/comments
   - After login + token exchange, call YOUR backend:
       GET http://localhost:3000/posts?access_token=...&user_id=...
   - UI shows returned posts + comments
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const APP_ID = '1251511386469731'
const REDIRECT_URI = 'https://socialai-theta.vercel.app/'
const TOKEN_ENDPOINT = import.meta.env.VITE_IG_TOKEN_ENDPOINT || "https://94048c036755.ngrok-free.app/api/instagram-token";
const POSTS_ENDPOINT = import.meta.env.VITE_POSTS_ENDPOINT || "https://94048c036755.ngrok-free.app/posts";

const scopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

export default function App() {
  const [authCode, setAuthCode] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("");
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loginUrl = useMemo(() => {
    const params = new URLSearchParams({
      force_reauth: "true",
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes.join(","),
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingCode = params.get("code");
    if (incomingCode) {
      setAuthCode(incomingCode.replace(/#_$/, ""));
      setStatus("Authorization code received. Exchanging for access token...");
    }
  }, []);

  const clearCodeFromUrl = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code");
      window.history.replaceState({}, document.title, url.toString());
    }
  };

  const fetchPostsFromBackend = useCallback(async (token, igUserId) => {
    try {
      setError("");
      setStatus("Loading posts from backend...");

      const params = new URLSearchParams({
        access_token: token,
        user_id: String(igUserId),
      });

      const resp = await fetch(`${POSTS_ENDPOINT}?${params.toString()}`);
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || "Failed to load posts");
      }

      const json = await resp.json();
      setPosts(json?.posts || []);
      setStatus("Connected");
    } catch (err) {
      setError(err?.message || "Unable to load posts.");
      setStatus("");
    }
  }, []);

  const exchangeCodeForToken = useCallback(
    async (code) => {
      try {
        setError("");

        const response = await fetch(TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: APP_ID,
            redirect_uri: REDIRECT_URI,
            code,
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Token exchange failed");
        }

        const data = await response.json();
        if (!data.access_token || !data.user_id) {
          throw new Error("Token endpoint did not return access_token and user_id.");
        }

        setAccessToken(data.access_token);
        setUserId(String(data.user_id));
        localStorage.setItem("ig_access_token", data.access_token);
        localStorage.setItem("ig_user_id", String(data.user_id));

        clearCodeFromUrl();
        setStatus("Access token received. Loading posts...");
        await fetchPostsFromBackend(data.access_token, data.user_id);
      } catch (err) {
        setError(err?.message || "Something went wrong while exchanging the code.");
        setStatus("");
      }
    },
    [fetchPostsFromBackend]
  );

  useEffect(() => {
    if (!authCode) return;
    if (accessToken) {
      clearCodeFromUrl();
      return;
    }
    exchangeCodeForToken(authCode);
  }, [authCode, exchangeCodeForToken, accessToken]);

  useEffect(() => {
    const storedToken = localStorage.getItem("ig_access_token");
    const storedUserId = localStorage.getItem("ig_user_id");
    if (storedToken && storedUserId && !accessToken) {
      setAccessToken(storedToken);
      setUserId(storedUserId);
      setStatus("Restored session. Loading posts...");
      fetchPostsFromBackend(storedToken, storedUserId);
    }
  }, [accessToken, fetchPostsFromBackend]);

  const handleLogout = () => {
    localStorage.removeItem("ig_access_token");
    localStorage.removeItem("ig_user_id");
    setAccessToken("");
    setUserId("");
    setPosts([]);
    setStatus("Logged out. Connect again to reload data.");
  };

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Instagram Business Login</h1>
          <p className="subtitle">
            Connect your Instagram professional account, then the backend will pull posts and comments.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-btn" type="button" onClick={() => window.open(loginUrl, "_self")}>
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
            <code className="code-block">{authCode || "Not received yet"}</code>
          </div>
          <div>
            <p className="label">Access token (short-lived)</p>
            <code className="code-block">{accessToken || "No token yet"}</code>
            <p className="note">Token is kept client-side for the session; backend uses it only to fetch posts.</p>
          </div>
          <div>
            <p className="label">Instagram user id</p>
            <code className="code-block">{userId || "Unknown"}</code>
          </div>
        </div>

        {accessToken && userId && (
          <button className="ghost-btn" type="button" onClick={() => fetchPostsFromBackend(accessToken, userId)}>
            Refresh posts
          </button>
        )}
      </section>

      <section className="posts">
        <div className="posts-header">
          <h2>Recent posts</h2>
        </div>

        {!posts.length && <p className="muted">No posts loaded yet. Connect your account to see data.</p>}

        <div className="media-grid">
          {posts.map((item) => (
            <article key={item.id} className="card">
              <div className="card-top">
                <p className="label">{item.media_type}</p>
                <a href={item.permalink} target="_blank" rel="noreferrer">
                  View on Instagram
                </a>
              </div>

              <p className="caption">{item.caption || "No caption"}</p>
              <p className="timestamp">{item.timestamp}</p>

              <div className="comments">
                <div className="comments-header">
                  <p className="label">Comments</p>
                </div>

                {item.comments?.length ? (
                  <ul>
                    {item.comments.map((comment) => (
                      <li key={comment.id}>
                        <span className="comment-user">{comment.username || "unknown"}</span>: {comment.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No comments found.</p>
                )}
              </div>
            </article>
          ))}
        </div>

        {!!posts.length && (
          <details className="json-dump">
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(posts, null, 2)}</pre>
          </details>
        )}
      </section>
    </main>
  );
}
