export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(value) {
  if (!value) return "";
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (seconds < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return RELATIVE.format(-Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(value, opts = { dateStyle: "medium" }) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(value));
}

export function formatDateTime(value) {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function compactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(value) || 0,
  );
}

export function truncate(text, max = 120) {
  const str = String(text || "");
  return str.length > max ? `${str.slice(0, max).trimEnd()}...` : str;
}

export function initialsOf(nameOrEmail) {
  const source = String(nameOrEmail || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
