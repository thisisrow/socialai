import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const APP_ID = '1251511386469731'
const REDIRECT_URI = 'https://socialai-theta.vercel.app/'

const TOKEN_ENDPOINT =
  import.meta.env.VITE_IG_TOKEN_ENDPOINT || "https://83e6e7546bf1.ngrok-free.app/api/instagram-token";

const POSTS_ENDPOINT =
  import.meta.env.VITE_POSTS_ENDPOINT || "https://83e6e7546bf1.ngrok-free.app/posts";

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

      const resp = await fetch(POSTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: token,
          user_id: String(igUserId),
        }),
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const msg = contentType.includes("application/json") ? JSON.stringify(await resp.json()) : await resp.text();
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

        const contentType = response.headers.get("content-type") || "";
        if (!response.ok) {
          const msg = contentType.includes("application/json")
            ? JSON.stringify(await response.json())
            : await response.text();
          throw new Error(msg || "Token exchange failed");
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
        setError(err?.message || "Token exchange failed.");
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
  }, [authCode, accessToken, exchangeCodeForToken]);

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
    setStatus("Logged out.");
  };

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Instagram Business Login</h1>
          <p className="subtitle">Connect Instagram, then backend returns posts and comments.</p>
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
      </section>

      <section className="token-box">
        <h2>Auth details</h2>
        <div className="token-grid">
          <div>
            <p className="label">Authorization code</p>
            <code className="code-block">{authCode || "Not received yet"}</code>
          </div>
          <div>
            <p className="label">Access token</p>
            <code className="code-block">{accessToken || "No token yet"}</code>
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
        <h2>Recent posts</h2>

        {!posts.length && <p className="muted">No posts loaded yet.</p>}

        <div className="media-grid">
          {posts.map((p) => (
            <article key={p.id} className="card">
              <div className="card-top">
                <p className="label">{p.media_type}</p>
                <a href={p.permalink} target="_blank" rel="noreferrer">View on Instagram</a>
              </div>

              <p className="caption">{p.caption || "No caption"}</p>
              <p className="timestamp">{p.timestamp}</p>

              <div className="comments">
                <p className="label">Comments</p>
                {p.comments?.length ? (
                  <ul>
                    {p.comments.map((c) => (
                      <li key={c.id}>
                        <span className="comment-user">{c.username || "unknown"}</span>: {c.text}
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
      </section>
    </main>
  );
}
