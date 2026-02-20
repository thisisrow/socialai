// App.jsx (frontend)
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import AccountSection from "./components/AccountSection";
import AuthSection from "./components/AuthSection";
import ContextModal from "./components/ContextModal";
import PostsSection from "./components/PostsSection";
import StatusBar from "./components/StatusBar";
import { IG_APP_ID, IG_REDIRECT_URI, IG_SCOPES } from "./config/env";
import { apiFetch } from "./lib/api";

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
      client_id: IG_APP_ID,
      redirect_uri: IG_REDIRECT_URI,
      response_type: "code",
      scope: IG_SCOPES.join(","),
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }, [IG_APP_ID, IG_REDIRECT_URI, IG_SCOPES]);

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
        client_id: IG_APP_ID,
        redirect_uri: IG_REDIRECT_URI,
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

  const handleSignup = () => signup().catch((e) => setError(e.message));
  const handleLogin = () => login().catch((e) => setError(e.message));
  const handleSaveInstagram = () => connectInstagram().catch((e) => setError(e.message));
  const handleLoadPosts = () => fetchPosts().catch((e) => setError(e.message));
  const handleToggleAutoReply = (postId) => togglePostAutoReply(postId).catch((e) => setError(e.message));
  const handleSaveContext = () => saveContext().catch((e) => setError(e.message));
  const handleDeleteContext = () => deleteContext().catch((e) => setError(e.message));

  return (
    <main className="page">
      <div className="layout">
        <aside className="sidebar">
          <header className="header">
            <div className="header-top">
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
            </div>

            <StatusBar status={status} error={error} />

            {jwtToken ? (
              <AccountSection
                authCode={authCode}
                loginUrl={loginUrl}
                onConnectInstagram={(url) => window.open(url, "_self")}
                onSaveConnection={handleSaveInstagram}
                onLoadPosts={handleLoadPosts}
              />
            ) : null}
          </header>

          {!jwtToken ? (
            <AuthSection
              email={email}
              password={password}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSignup={handleSignup}
              onLogin={handleLogin}
            />
          ) : null}
        </aside>

        <section className="content">
          {jwtToken ? (
            <PostsSection
              posts={posts}
              contextMap={contextMap}
              stateMap={stateMap}
              onOpenContext={openContextModal}
              onToggleAutoReply={handleToggleAutoReply}
            />
          ) : null}
        </section>
      </div>

      <ContextModal
        open={contextModalOpen}
        draft={contextDraft}
        onChange={setContextDraft}
        onSave={handleSaveContext}
        onDelete={handleDeleteContext}
        onClose={closeContextModal}
      />
    </main>
  );
}
