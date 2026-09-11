const RAW_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
export const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

const ACCESS_KEY = "socialai.accessToken";
const REFRESH_KEY = "socialai.refreshToken";

/**
 * Tokens live in localStorage rather than an httpOnly cookie because the API and
 * the SPA are deployed on different origins, where third-party cookies are
 * unreliable. The access token is therefore kept short (15m) and the refresh
 * token rotates on every use, so a stolen one is single-use and detectable.
 */
export const tokenStore = {
  get access() {
    try {
      return localStorage.getItem(ACCESS_KEY) || "";
    } catch {
      return "";
    }
  },
  get refresh() {
    try {
      return localStorage.getItem(REFRESH_KEY) || "";
    } catch {
      return "";
    }
  },
  set({ accessToken, refreshToken }) {
    try {
      if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    } catch {
      /* storage blocked; session lasts for this tab only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Concurrent 401s share one refresh call instead of racing to rotate the token.
let refreshInFlight = null;

async function refreshSession() {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        tokenStore.set(data);
        return true;
      } catch {
        return false;
      } finally {
        // Cleared on the next tick so every awaiting caller reads this result.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function parse(res) {
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  const text = await res.text();
  return text ? { error: text } : {};
}

async function request(path, { method = "GET", body, auth = true, retry = true, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("Cannot reach the server. Is the API running?", { code: "network_error" });
  }

  if (res.status === 401 && auth && retry) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, { method, body, auth, retry: false, signal });
    tokenStore.clear();
    onUnauthorized?.();
  }

  const payload = await parse(res);
  if (!res.ok) {
    throw new ApiError(payload?.error || `Request failed (${res.status})`, {
      status: res.status,
      code: payload?.code,
      details: payload?.details,
    });
  }
  return payload;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const api = {
  auth: {
    signup: (body) => request("/api/auth/signup", { method: "POST", body, auth: false }),
    login: (body) => request("/api/auth/login", { method: "POST", body, auth: false }),
    logout: (refreshToken) =>
      request("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false }),
    me: () => request("/api/auth/me"),
    updateProfile: (body) => request("/api/auth/me", { method: "PATCH", body }),
    changePassword: (body) => request("/api/auth/change-password", { method: "POST", body }),
    logoutEverywhere: () => request("/api/auth/logout-all", { method: "POST" }),
  },
  instagram: {
    authorizeUrl: (redirectUri) => request(`/api/instagram/authorize-url${qs({ redirectUri })}`),
    connect: (body) => request("/api/instagram/connect", { method: "POST", body }),
    disconnect: (purge) => request(`/api/instagram/connect${qs({ purge })}`, { method: "DELETE" }),
    status: () => request("/api/instagram/status"),
  },
  posts: {
    list: (params) => request(`/api/posts${qs(params)}`),
    get: (mediaId) => request(`/api/posts/${mediaId}`),
    sync: (limit) => request("/api/posts/sync", { method: "POST", body: { limit } }),
    setContext: (mediaId, context) =>
      request(`/api/posts/${mediaId}/context`, { method: "PUT", body: { context } }),
    setAutomation: (mediaId, enabled) =>
      request(`/api/posts/${mediaId}/automation`, { method: "PUT", body: { enabled } }),
    bulkAutomation: (enabled, mediaIds) =>
      request("/api/posts/automation/bulk", { method: "POST", body: { enabled, mediaIds } }),
  },
  comments: {
    list: (params) => request(`/api/comments${qs(params)}`),
    draft: (id) => request(`/api/comments/${id}/draft`, { method: "POST" }),
    reply: (id, message) => request(`/api/comments/${id}/reply`, { method: "POST", body: { message } }),
    skip: (id) => request(`/api/comments/${id}/skip`, { method: "POST" }),
    reopen: (id) => request(`/api/comments/${id}/reopen`, { method: "POST" }),
  },
  ai: {
    getSettings: () => request("/api/ai/settings"),
    saveSettings: (body) => request("/api/ai/settings", { method: "PUT", body }),
    preview: (body) => request("/api/ai/preview", { method: "POST", body }),
    test: () => request("/api/ai/test", { method: "POST" }),
  },
  stats: {
    overview: (days) => request(`/api/stats/overview${qs({ days })}`),
    activity: (limit) => request(`/api/stats/activity${qs({ limit })}`),
  },
};
