import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  ChevronDown,
  Images,
  Instagram,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  X,
  Menu,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Badge, Button } from "../ui";
import { cx, initialsOf } from "../../lib/format";
import Logo from "../Logo";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Inbox", icon: MessageSquare, badgeKey: "pending" },
  { to: "/posts", label: "Posts", icon: Images },
  { to: "/automation", label: "AI Automation", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItem({ item, badge, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
          isActive
            ? "bg-brand-500/12 text-brand-700 dark:text-brand-300"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />
          )}
          <Icon className="size-[18px] shrink-0" aria-hidden />
          <span className="flex-1 truncate">{item.label}</span>
          {badge > 0 && (
            <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold tabular-nums text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">
          {initialsOf(user?.name || user?.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">
            {user?.name || "Account"}
          </span>
          <span className="block truncate text-[11px] text-subtle">{user?.email}</span>
        </span>
        <ChevronDown
          className={cx("size-4 shrink-0 text-[var(--text-subtle)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-pop absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-pop"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <Settings className="size-4 text-[var(--text-subtle)]" aria-hidden />
            Account settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={toggle}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-[var(--text-subtle)]" aria-hidden />
            ) : (
              <Moon className="size-4 text-[var(--text-subtle)]" aria-hidden />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="border-t border-[var(--border)]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => logout()}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectionPill() {
  const { instagram } = useAuth();
  const navigate = useNavigate();

  if (!instagram?.connected) {
    return (
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-left transition-colors hover:border-brand-500 hover:bg-brand-500/5"
      >
        <Instagram className="size-4 shrink-0 text-[var(--text-subtle)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium">Connect Instagram</span>
          <span className="block text-[11px] text-subtle">Required to sync posts</span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5">
      {instagram.profilePictureUrl ? (
        <img
          src={instagram.profilePictureUrl}
          alt=""
          className="size-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-amber-500 text-white">
          <Instagram className="size-3.5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">@{instagram.username}</span>
        <span className="block text-[11px] text-subtle">
          {instagram.needsReconnect ? "Reconnect needed" : "Connected"}
        </span>
      </span>
      <span
        className={cx(
          "size-1.5 shrink-0 rounded-full",
          instagram.needsReconnect ? "bg-amber-500" : "bg-emerald-500",
        )}
      />
    </div>
  );
}

export default function AppShell({ pendingCount = 0 }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center justify-between px-1">
        <Logo />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="text-[var(--text-subtle)] lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <ConnectionPill />

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            badge={item.badgeKey === "pending" ? pendingCount : 0}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-brand-500/10 to-transparent p-3.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
          <p className="text-[12.5px] font-semibold">Powered by Claude</p>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          Replies are generated from the context you write for each post, so nothing gets invented.
        </p>
      </div>

      <UserMenu />
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-[var(--border)] bg-[var(--surface)] lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="animate-pop absolute inset-y-0 left-0 w-[280px] border-r border-[var(--border)] bg-[var(--surface)]">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <Logo compact />
          {pendingCount > 0 && (
            <Badge tone="brand" className="ml-auto">
              {pendingCount} pending
            </Badge>
          )}
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
