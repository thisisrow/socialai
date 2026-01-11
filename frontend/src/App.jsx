import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const APP_ID = "1251511386469731";
const REDIRECT_URI = "https://socialai-theta.vercel.app/";

// Same-origin (Vercel rewrite) endpoints
const TOKEN_ENDPOINT = `/api/instagram-token`;
const POSTS_ENDPOINT = `/posts`;
const CONTEXT_ENDPOINT = `/api/context`;
const POSTSTATE_ENDPOINT = `/api/post-state`;
const SAVE_TOKEN_ENDPOINT = `/api/user/token`;

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

export default function App() {
  const [authCode, setAuthCode] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("");

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

  // IMPORTANT: do NOT fail the whole login if this endpoint doesn't exist yet
  const saveTokenToBackend = useCallback(async (uid, token) => {
    try {
      const r = await fetch(SAVE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: String(uid), accessToken: String(token) }),
      });

      if (!r.ok) {
        // swallow 404/500 so old flow still works
        const txt = await r.text().catch(() => "");
        console.warn("saveTokenToBackend failed:", r.status, txt);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("saveTokenToBackend error:", e?.message || e);
      return false;
    }
  }, []);

  const loadServerConfigs = useCallback(async (uid) => {
    try {
      const [ctxRes, stRes] = await Promise.all([
        fetch(`${CONTEXT_ENDPOINT}?userId=${encodeURIComponent(uid)}`),
        fetch(`${POSTSTATE_ENDPOINT}?userId=${encodeURIComponent(uid)}`),
      ]);

      const ctxJson = ctxRes.ok ? await ctxRes.json() : { contextMap: {} };
      const stJson = stRes.ok ? await stRes.json() : { stateMap: {} };

      setContextMap(ctxJson.contextMap || {});
      setStateMap(stJson.stateMap || {});
    } catch {
      // ignore
    }
  }, []);

  const fetchPostsFromBackend = useCallback(async (token, igUserId) => {
    try {
      setError("");
      setStatus("Loading posts...");

      const resp = await fetch(POSTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, user_id: String(igUserId) }),
      });

      const ct = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const msg = ct.includes("application/json")
          ? JSON.stringify(await resp.json())
          : await resp.text();
        throw new Error(msg || "Failed to load posts");
      }

      const json = await resp.json();
      setPosts(json?.posts || []);

      if (json?.contextMap) setContextMap(json.contextMap);
      if (json?.stateMap) setStateMap(json.stateMap);

      setStatus("Connected");
    } catch (e) {
      setError(e?.message || "Unable to load posts.");
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

        const ct = response.headers.get("content-type") || "";
        if (!response.ok) {
          const msg = ct.includes("application/json")
            ? JSON.stringify(await response.json())
            : await response.text();
          throw new Error(msg || "Token exchange failed");
        }

        const data = await response.json();
        if (!data.access_token || !data.user_id) {
          throw new Error("Token endpoint missing access_token/user_id");
        }

        setAccessToken(data.access_token);
        setUserId(String(data.user_id));

        localStorage.setItem("ig_access_token", data.access_token);
        localStorage.setItem("ig_user_id", String(data.user_id));

        // best-effort save for webhook automation (won't break UI if missing)
        await saveTokenToBackend(String(data.user_id), data.access_token);

        clearCodeFromUrl();

        await loadServerConfigs(String(data.user_id));
        await fetchPostsFromBackend(data.access_token, data.user_id);
      } catch (e) {
        setError(e?.message || "Token exchange failed.");
        setStatus("");
      }
    },
    [fetchPostsFromBackend, loadServerConfigs, saveTokenToBackend]
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

      (async () => {
        try {
          setStatus("Restoring session...");

          // best-effort save for webhook automation
          await saveTokenToBackend(storedUserId, storedToken);

          await loadServerConfigs(storedUserId);
          await fetchPostsFromBackend(storedToken, storedUserId);
        } catch (e) {
          setError(e?.message || "Failed to restore session");
          setStatus("");
        }
      })();
    }
  }, [accessToken, fetchPostsFromBackend, loadServerConfigs, saveTokenToBackend]);

  const handleLogout = () => {
    localStorage.removeItem("ig_access_token");
    localStorage.removeItem("ig_user_id");
    setAuthCode("");
    setAccessToken("");
    setUserId("");
    setPosts([]);
    setContextMap({});
    setStateMap({});
    setStatus("Logged out.");
    setError("");
  };

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
    if (!activePostId || !userId) return;
    const text = contextDraft.trim();
    if (!text) return;

    try {
      const r = await fetch(CONTEXT_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, postId: activePostId, text }),
      });

      if (!r.ok) throw new Error(await r.text());

      setContextMap((prev) => ({ ...prev, [activePostId]: text }));
      setStatus("Context saved");
    } catch (e) {
      setError(e?.message || "Failed to save context");
    }
  };

  const deleteContext = async () => {
    if (!activePostId || !userId) return;

    try {
      const r = await fetch(CONTEXT_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, postId: activePostId }),
      });

      if (!r.ok) throw new Error(await r.text());

      setContextMap((prev) => {
        const next = { ...prev };
        delete next[activePostId];
        return next;
      });
      setContextDraft("");
      setStatus("Context deleted");
    } catch (e) {
      setError(e?.message || "Failed to delete context");
    }
  };

  const togglePostAutoReply = async (postId) => {
    if (!userId) return;

    const current = Boolean(stateMap?.[postId]?.autoReplyEnabled);
    const next = !current;

    try {
      const r = await fetch(POSTSTATE_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, postId, enabled: next }),
      });

      if (!r.ok) throw new Error(await r.text());
      const json = await r.json();

      setStateMap((prev) => ({
        ...prev,
        [postId]: {
          autoReplyEnabled: Boolean(json?.state?.autoReplyEnabled),
          sinceMs: json?.state?.sinceMs ?? null,
        },
      }));
    } catch (e) {
      setError(e?.message || "Failed to update post state");
    }
  };

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Instagram Business Login</h1>
          <p className="subtitle">Connect Instagram, set context, enable auto reply.</p>
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
                    onClick={() => togglePostAutoReply(p.id)}
                    disabled={!accessToken}
                    title={!accessToken ? "Connect account first" : ""}
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
        <p className="muted small">This context is stored in MongoDB and used by AI replies for this post.</p>

        <textarea
          className="context-textarea"
          rows={7}
          value={contextDraft}
          onChange={(e) => setContextDraft(e.target.value)}
          placeholder="Write context for this post..."
        />

        <div className="modal-actions">
          <button className="primary-btn" type="button" onClick={saveContext}>
            Save
          </button>
          <button className="danger-btn" type="button" onClick={deleteContext}>
            Delete
          </button>
        </div>
      </Modal>
    </main>
  );
}
