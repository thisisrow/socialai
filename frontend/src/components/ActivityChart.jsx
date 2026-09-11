import { useMemo, useState } from "react";

/**
 * Small inline SVG area chart. Two series, no charting dependency.
 * Colours come from the brand tokens so it reads correctly in both themes.
 */
export default function ActivityChart({ series = [], height = 190 }) {
  const [hover, setHover] = useState(null);

  const { paths, max, width, points } = useMemo(() => {
    const w = 720;
    const padY = 12;
    const n = Math.max(series.length, 2);
    const peak = Math.max(1, ...series.flatMap((d) => [d.replies || 0, d.comments || 0]));
    const stepX = w / (n - 1);
    const scaleY = (v) => height - padY - (v / peak) * (height - padY * 2);

    const build = (key) => {
      const coords = series.map((d, i) => [i * stepX, scaleY(d[key] || 0)]);
      if (!coords.length) return { line: "", area: "" };
      // Cubic smoothing through the midpoints keeps the curve readable.
      let line = `M ${coords[0][0]},${coords[0][1]}`;
      for (let i = 1; i < coords.length; i += 1) {
        const [px, py] = coords[i - 1];
        const [cxp, cy] = coords[i];
        const midX = (px + cxp) / 2;
        line += ` C ${midX},${py} ${midX},${cy} ${cxp},${cy}`;
      }
      const area = `${line} L ${coords.at(-1)[0]},${height} L ${coords[0][0]},${height} Z`;
      return { line, area };
    };

    return {
      width: w,
      max: peak,
      paths: { comments: build("comments"), replies: build("replies") },
      points: series.map((d, i) => ({ ...d, x: i * stepX })),
    };
  }, [series, height]);

  if (!series.length) return null;

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 px-1">
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="size-2 rounded-full bg-brand-500" /> Replies sent
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="size-2 rounded-full bg-[var(--border-strong)]" /> Comments received
        </span>
        <span className="ml-auto text-[11px] text-subtle">Peak {max}/day</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Replies and comments over the last ${series.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="fillReplies" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
        ))}

        <path d={paths.comments.line} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
        <path d={paths.replies.area} fill="url(#fillReplies)" />
        <path
          d={paths.replies.line}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1="0"
            y2={height}
            stroke="var(--color-brand-500)"
            strokeWidth="1"
            strokeOpacity="0.4"
          />
        )}

        {points.map((p, i) => (
          <rect
            key={p.date}
            x={p.x - width / points.length / 2}
            y="0"
            width={width / points.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] shadow-pop"
          style={{ left: `${(active.x / width) * 100}%` }}
        >
          <p className="font-semibold">
            {new Date(`${active.date}T00:00:00Z`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-muted">
            {active.replies} replied / {active.comments} received
          </p>
        </div>
      )}
    </div>
  );
}
