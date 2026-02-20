import { API_BASE } from "../config/env";

const normalizeBase = (base) => {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

const BASE = normalizeBase(API_BASE);

export async function apiFetch(path, { token, ...opts } = {}) {
  const r = await fetch(`${BASE}${path}`, {
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
