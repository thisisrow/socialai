// App.jsx (frontend)
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const APP_ID = "1251511386469731";
const REDIRECT_URI = "https://socialai-theta.vercel.app/";

// backend base (ngrok or deployed)
const API_BASE = "https://7d701c3c835f.ngrok-free.app";

const scopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="ghost-btn small-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

async function apiFetch(path, { token, ...opts } = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const ct = r.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await r.json() : await r.text();

  if (!r.ok) {
    const msg = typeof payload === "string" ? payload : payload?.error || JSON.stringify(payload);
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return payload;
}

export default function App() {
  const [jwtToken, setJwtToken] = useState(localStorage.getItem("jwt_token") || "");
  const [me, setMe] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authCode, setAuthCode] = useState("");

  const [posts, setPosts] = useState([]);
  const [contextMap, setContextMap] = useState({});
  const [stateMap, setStateMap] = useState({});

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [activePostId, setActivePostId] = useState(null);
  const [contextDraft, setContextDraft] = useState("");

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

  const clearCodeFromUrl = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code");
      window.history.replaceState({}, document.title, url.toString());
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingCode = params.get("code");
    if (incomingCode) setAuthCode(incomingCode.replace(/#_$/, ""));
  }, []);

  const loadMe = useCallback(async (token) => {
    const data = await apiFetch("/api/me", { token });
    setMe(data);
  }, []);

  useEffect(() => {
    if (!jwtToken) return;
    loadMe(jwtToken).catch(() => {
      localStorage.removeItem("jwt_token");
      setJwtToken("");
      setMe(null);
    });
  }, [jwtToken, loadMe]);

  const signup = async () => {
    setError("");
    setStatus("Signing up...");
    const data = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("jwt_token", data.token);
    setJwtToken(data.token);
    setStatus("Signed up");
  };

  const login = async () => {
    setError("");
    setStatus("Logging in...");
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("jwt_token", data.token);
    setJwtToken(data.token);
    setStatus("Logged in");
  };

  const logout = () => {
    localStorage.removeItem("jwt_token");
    setJwtToken("");
    setMe(null);
    setPosts([]);
    setContextMap({});
    setStateMap({});
    setStatus("Logged out");
    setError("");
  };

  const connectInstagram = async () => {
    if (!jwtToken || !authCode) return;
    setError("");
    setStatus("Connecting Instagram...");
    await apiFetch("/api/instagram-token", {
      token: jwtToken,
      method: "POST",
      body: JSON.stringify({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        code: authCode,
      }),
    });
    clearCodeFromUrl();
    setAuthCode("");
    await loadMe(jwtToken);
    setStatus("Instagram connected");
  };

  const loadServerConfigs = useCallback(async () => {
    if (!jwtToken) return;
    const [ctx, st] = await Promise.all([
      apiFetch("/api/context", { token: jwtToken }),
      apiFetch("/api/post-state", { token: jwtToken }),
    ]);
    setContextMap(ctx.contextMap || {});
    setStateMap(st.stateMap || {});
  }, [jwtToken]);

  const fetchPosts = useCallback(async () => {
    if (!jwtToken) return;
    setError("");
    setStatus("Loading posts...");
    const json = await apiFetch("/posts", { token: jwtToken, method: "POST", body: JSON.stringify({}) });
    setPosts(json.posts || []);
    if (json.contextMap) setContextMap(json.contextMap);
    if (json.stateMap) setStateMap(json.stateMap);
    setStatus("Connected");
  }, [jwtToken]);

  useEffect(() => {
    if (!jwtToken) return;
    loadServerConfigs().catch(() => {});
  }, [jwtToken, loadServerConfigs]);

  const openContextModal = (postId) => {
    setActivePostId(postId);
    setContextDraft(contextMap?.[postId] || "");
    setContextModalOpen(true);
  };

  const closeContextModal = () => {
    setContextModalOpen(false);
    setActivePostId(null);
    setContextDraft("");
  };

  const saveContext = async () => {
    if (!jwtToken || !activePostId) return;
    const text = contextDraft.trim();
    if (!text) return;

    setError("");
    await apiFetch("/api/context", {
      token: jwtToken,
      method: "PUT",
      body: JSON.stringify({ postId: activePostId, text }),
    });

    setContextMap((prev) => ({ ...prev, [activePostId]: text }));
    setStatus("Context saved");
  };

  const deleteContext = async () => {
    if (!jwtToken || !activePostId) return;
    setError("");
    await apiFetch("/api/context", {
      token: jwtToken,
      method: "DELETE",
      body: JSON.stringify({ postId: activePostId }),
    });

    setContextMap((prev) => {
      const next = { ...prev };
      delete next[activePostId];
      return next;
    });
    setContextDraft("");
    setStatus("Context deleted");
  };

  const togglePostAutoReply = async (postId) => {
    if (!jwtToken) return;
    const current = Boolean(stateMap?.[postId]?.autoReplyEnabled);
    const next = !current;

    setError("");
    const json = await apiFetch("/api/post-state", {
      token: jwtToken,
      method: "PUT",
      body: JSON.stringify({ postId, enabled: next }),
    });

    setStateMap((prev) => ({
      ...prev,
      [postId]: {
        autoReplyEnabled: Boolean(json?.state?.autoReplyEnabled),
        sinceMs: json?.state?.sinceMs ?? null,
      },
    }));
  };

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>SocialAI</h1>
          <p className="subtitle">Login, connect Instagram, set context, enable auto reply.</p>
        </div>
        <div className="header-actions">
          {jwtToken ? (
            <button className="ghost-btn" type="button" onClick={logout}>
              Log out
            </button>
          ) : null}
        </div>
      </header>

      <section className="status-bar">
        {status && <div className="status-chip">{status}</div>}
        {error && <div className="error-chip">Error: {error}</div>}
      </section>

      {!jwtToken ? (
        <section className="token-box">
          <h2>Sign up / Login</h2>
          <div className="token-grid">
            <div>
              <p className="label">Email</p>
              <input className="code-block" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <p className="label">Password</p>
              <input
                className="code-block"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button className="primary-btn" type="button" onClick={() => signup().catch((e) => setError(e.message))}>
              Sign up
            </button>
            <button className="ghost-btn" type="button" onClick={() => login().catch((e) => setError(e.message))}>
              Login
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="token-box">
            <h2>Account</h2>
            <div className="token-grid">
              <div>
                <p className="label">Email</p>
                <code className="code-block">{me?.user?.email || "..."}</code>
              </div>
              <div>
                <p className="label">Instagram connected</p>
                <code className="code-block">{me?.instagramConnected ? "Yes" : "No"}</code>
              </div>
              <div>
                <p className="label">Instagram auth code</p>
                <code className="code-block">{authCode || "Not received"}</code>
              </div>
              <div>
                <p className="label">Basic User ID</p>
                <code className="code-block">{me?.basicUserId || "—"}</code>
              </div>
              <div>
                <p className="label">Business IG ID (webhook)</p>
                <code className="code-block">{me?.igBusinessId || "—"}</code>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button className="primary-btn" type="button" onClick={() => window.open(loginUrl, "_self")}>
                Connect Instagram
              </button>
              {authCode && (
                <button className="ghost-btn" type="button" onClick={() => connectInstagram().catch((e) => setError(e.message))}>
                  Save Instagram Connection
                </button>
              )}
              <button className="ghost-btn" type="button" onClick={() => fetchPosts().catch((e) => setError(e.message))}>
                Load posts
              </button>
            </div>
          </section>

          <section className="posts">
            <h2>Recent posts</h2>
            {!posts.length && <p className="muted">No posts loaded yet.</p>}

            <div className="media-grid">
              {posts.map((p) => {
                const ctx = contextMap?.[p.id] || "";
                const enabled = Boolean(stateMap?.[p.id]?.autoReplyEnabled);

                return (
                  <article key={p.id} className="card">
                    <div className="card-top">
                      <p className="label">{p.media_type}</p>
                      <a href={p.permalink} target="_blank" rel="noreferrer">
                        View on Instagram
                      </a>
                    </div>

                    <p className="caption">{p.caption || "No caption"}</p>
                    <p className="timestamp">{p.timestamp}</p>

                    <div className="card-actions">
                      <button className="ghost-btn small-btn" type="button" onClick={() => openContextModal(p.id)}>
                        {ctx ? "Edit context" : "Add context"}
                      </button>

                      {ctx && <span className="chip">Context saved</span>}

                      <button
                        type="button"
                        className={enabled ? "toggle-btn on" : "toggle-btn off"}
                        onClick={() => togglePostAutoReply(p.id).catch((e) => setError(e.message))}
                      >
                        {enabled ? "AI Reply ON" : "AI Reply OFF"}
                      </button>
                    </div>

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
                );
              })}
            </div>
          </section>

          <Modal open={contextModalOpen} title="Post context" onClose={closeContextModal}>
            <p className="muted small">Saved in MongoDB. Used for AI replies on this post.</p>

            <textarea
              className="context-textarea"
              rows={7}
              value={contextDraft}
              onChange={(e) => setContextDraft(e.target.value)}
              placeholder="Write context for this post..."
            />

            <div className="modal-actions">
              <button className="primary-btn" type="button" onClick={() => saveContext().catch((e) => setError(e.message))}>
                Save
              </button>
              <button className="danger-btn" type="button" onClick={() => deleteContext().catch((e) => setError(e.message))}>
                Delete
              </button>
            </div>
          </Modal>
        </>
      )}
    </main>
  );
}
