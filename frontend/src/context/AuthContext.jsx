import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [instagram, setInstagram] = useState({ connected: false });
  // "loading" until the stored token has been checked, so protected routes do
  // not bounce a signed-in user to /login on a hard refresh.
  const [status, setStatus] = useState(tokenStore.access ? "loading" : "anonymous");
  const mounted = useRef(true);

  // Must set `true` on mount, not just `false` on unmount: StrictMode mounts,
  // unmounts and remounts in development, and a cleanup-only version would
  // leave this permanently false, silently dropping every later state update.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applySession = useCallback((session) => {
    tokenStore.set(session);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const signOutLocal = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setInstagram({ connected: false });
    setStatus("anonymous");
  }, []);

  // The api layer calls this when a refresh attempt has already failed.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (mounted.current) signOutLocal();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOutLocal]);

  const refreshMe = useCallback(async () => {
    const data = await api.auth.me();
    if (!mounted.current) return data;
    setUser(data.user);
    setInstagram(data.instagram || { connected: false });
    setStatus("authenticated");
    return data;
  }, []);

  useEffect(() => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setStatus("anonymous");
      return;
    }
    refreshMe().catch(() => {
      if (mounted.current) signOutLocal();
    });
  }, [refreshMe, signOutLocal]);

  const value = useMemo(
    () => ({
      user,
      instagram,
      status,
      isAuthenticated: status === "authenticated",
      isLoading: status === "loading",

      async login(credentials) {
        const session = await api.auth.login(credentials);
        applySession(session);
        await refreshMe().catch(() => {});
        return session;
      },

      async signup(details) {
        const session = await api.auth.signup(details);
        applySession(session);
        await refreshMe().catch(() => {});
        return session;
      },

      async logout() {
        // Best effort: revoke server-side, but always clear locally.
        await api.auth.logout(tokenStore.refresh).catch(() => {});
        signOutLocal();
      },

      setUser,
      setInstagram,
      refreshMe,
    }),
    [user, instagram, status, applySession, refreshMe, signOutLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
