import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { cx } from "../../lib/format";

/* ------------------------------------------------------------------ Button */

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-sm disabled:bg-brand-600/50",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
  danger: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-sm",
  outlineDanger:
    "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.985]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      )}
      {children}
    </button>
  );
}

/**
 * Same styling as Button but renders a router <Link>. Use this for navigation:
 * putting a <button> inside an <a> is invalid HTML and breaks keyboard access.
 */
export function LinkButton({ to, variant = "secondary", size = "md", icon: Icon, className, children, ...props }) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.985]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />}
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Inputs */

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium">
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] text-red-500">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-[12px] text-subtle">{hint}</span>
      )}
    </label>
  );
}

const INPUT_BASE =
  "w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg)] px-3.5 text-sm " +
  "placeholder:text-[var(--text-subtle)] transition-colors " +
  "hover:border-[var(--text-subtle)] focus:border-brand-500 focus:outline-none " +
  "focus:ring-4 focus:ring-brand-500/12 disabled:opacity-60";

export function Input({ className, invalid, icon: Icon, ...props }) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]"
          aria-hidden
        />
        <input
          className={cx(INPUT_BASE, "h-10 pl-9", invalid && "border-red-400", className)}
          {...props}
        />
      </div>
    );
  }
  return <input className={cx(INPUT_BASE, "h-10", invalid && "border-red-400", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cx(INPUT_BASE, "resize-y py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cx(INPUT_BASE, "h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]"
        aria-hidden
      />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search...", className }) {
  return (
    <div className={cx("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(INPUT_BASE, "h-9 pl-9")}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Switch */

export function Switch({ checked, onChange, disabled, label, size = "md" }) {
  const small = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200",
        small ? "h-5 w-9" : "h-6 w-11",
        checked ? "bg-brand-600" : "bg-[var(--border-strong)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cx(
          "inline-block transform rounded-full bg-white shadow transition-transform duration-200",
          small ? "size-3.5" : "size-[18px]",
          checked
            ? small
              ? "translate-x-[18px]"
              : "translate-x-[22px]"
            : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------- Badge */

const BADGE_TONES = {
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]",
  brand: "bg-brand-500/12 text-brand-700 dark:text-brand-300 border-brand-500/25",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  warning: "bg-amber-500/14 text-amber-700 dark:text-amber-400 border-amber-500/28",
  danger: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/25",
};

export function Badge({ tone = "neutral", icon: Icon, className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Tabs */

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-1",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === tab.value
              ? "bg-[var(--surface)] text-[var(--text)] shadow-card"
              : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count !== null && (
            <span
              className={cx(
                "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
                value === tab.value
                  ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
                  : "bg-[var(--border)] text-[var(--text-muted)]",
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */

export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog so keyboard users are not left behind it.
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "animate-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl",
          "border border-[var(--border)] bg-[var(--surface)] shadow-pop sm:rounded-2xl",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------- Empty/Skel */

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]">
          <Icon className="size-5 text-[var(--text-subtle)]" aria-hidden />
        </div>
      )}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx("shimmer rounded-lg", className)} />;
}

/* ------------------------------------------------------------------ Toasts */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id));

  const push = (toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, ...toast }]);
    if (toast.duration !== 0) {
      setTimeout(() => dismiss(id), toast.duration || 4500);
    }
    return id;
  };

  const toast = {
    success: (title, description) => push({ tone: "success", title, description }),
    error: (title, description) => push({ tone: "error", title, description, duration: 7000 }),
    info: (title, description) => push({ tone: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              "animate-in pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--surface)] p-3.5 shadow-pop",
              t.tone === "success" && "border-emerald-500/30",
              t.tone === "error" && "border-red-500/30",
              t.tone === "info" && "border-[var(--border-strong)]",
            )}
          >
            <span
              className={cx(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                t.tone === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                t.tone === "error" && "bg-red-500/15 text-red-600 dark:text-red-400",
                t.tone === "info" && "bg-brand-500/15 text-brand-600 dark:text-brand-300",
              )}
            >
              {t.tone === "success" ? <Check className="size-3" /> : <span className="text-[11px] font-bold">!</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 break-words text-[12px] text-muted">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ----------------------------------------------------------------- Tooltip */

export function Tooltip({ label, children }) {
  const id = useId();
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--text)] px-2 py-1 text-[11px] font-medium text-[var(--bg)] opacity-0 transition-opacity group-hover/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
