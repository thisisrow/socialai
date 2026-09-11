import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Images,
  Instagram,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Skeleton,
  useToast,
} from "../components/ui";
import ActivityChart from "../components/ActivityChart";
import PageHeader from "../components/layout/PageHeader";
import { cx, timeAgo, truncate } from "../lib/format";

const ACTIVITY_ICONS = {
  "reply.sent": { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  "reply.failed": { icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" },
  "posts.synced": { icon: RefreshCw, tone: "text-brand-600 dark:text-brand-400" },
  "instagram.connected": { icon: Instagram, tone: "text-pink-600 dark:text-pink-400" },
  "instagram.disconnected": { icon: Instagram, tone: "text-[var(--text-subtle)]" },
  "instagram.error": { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
  "automation.enabled": { icon: Zap, tone: "text-brand-600 dark:text-brand-400" },
  "automation.disabled": { icon: Zap, tone: "text-[var(--text-subtle)]" },
};

function StatCard({ icon: Icon, label, value, sub, tone = "brand", to }) {
  const tones = {
    brand: "from-brand-500/15 text-brand-600 dark:text-brand-400",
    emerald: "from-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    amber: "from-amber-500/15 text-amber-600 dark:text-amber-400",
    slate: "from-[var(--border)] text-[var(--text-muted)]",
  };
  const body = (
    <Card
      className={cx(
        "group p-5 transition-all",
        to && "hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-pop",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "grid size-10 place-items-center rounded-xl bg-gradient-to-br to-transparent",
            tones[tone],
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {to && (
          <ArrowUpRight className="size-4 text-[var(--text-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <p className="mt-4 text-[28px] font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[13px] font-medium">{label}</p>
      {sub && <p className="mt-0.5 text-[12px] text-subtle">{sub}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function OnboardingCard({ instagram, totals, onSync, syncing }) {
  const steps = [
    {
      done: Boolean(instagram?.connected),
      title: "Connect your Instagram account",
      body: "Link the professional account whose comments you want handled.",
      action: (
        <LinkButton to="/settings" size="sm">
          Go to Settings
        </LinkButton>
      ),
    },
    {
      done: (totals?.posts || 0) > 0,
      title: "Sync your posts",
      body: "Pull in recent media so you can add context to each one.",
      action: (
        <Button size="sm" variant="secondary" loading={syncing} onClick={onSync}>
          Sync now
        </Button>
      ),
    },
    {
      done: (totals?.postsWithContext || 0) > 0,
      title: "Add context to a post",
      body: "Tell Claude the facts it may use: hours, prices, shipping, anything.",
      action: (
        <LinkButton to="/posts" size="sm">
          Open Posts
        </LinkButton>
      ),
    },
    {
      done: (totals?.automatedPosts || 0) > 0,
      title: "Turn on auto-reply",
      body: "Flip the switch on a post and new comments get answered automatically.",
      action: (
        <LinkButton to="/posts" size="sm">
          Enable
        </LinkButton>
      ),
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-gradient-to-r from-brand-500/10 to-transparent px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkles className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
              Finish setting up
            </h3>
            <p className="mt-1 text-[13px] text-muted">
              {completed} of {steps.length} steps done
            </p>
          </div>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="divide-y divide-[var(--border)]">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-3.5 px-5 py-3.5">
            <span
              className={cx(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                step.done
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "border border-[var(--border-strong)] text-[var(--text-subtle)]",
              )}
            >
              {step.done ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("text-[13.5px] font-medium", step.done && "text-muted line-through")}>
                {step.title}
              </p>
              {!step.done && <p className="mt-0.5 text-[12px] text-subtle">{step.body}</p>}
            </div>
            {!step.done && step.action}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function DashboardPage({ onCountsChange }) {
  const { user, instagram, refreshMe } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const overview = await api.stats.overview(14);
      setData(overview);
      onCountsChange?.({ pending: overview.totals.pending });
    } catch (e) {
      toast.error("Could not load the dashboard", e.message);
    } finally {
      setLoading(false);
    }
    // toast/onCountsChange are stable enough; re-running on them would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await api.posts.sync();
      toast.success(
        "Sync complete",
        `${result.posts} posts checked, ${result.commentsNew} new comments found.`,
      );
      await Promise.all([load(), refreshMe().catch(() => {})]);
    } catch (e) {
      toast.error("Sync failed", e.message);
    } finally {
      setSyncing(false);
    }
  };

  const totals = data?.totals;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Here is how your Instagram comments are being handled."
        actions={
          instagram?.connected && (
            <Button icon={RefreshCw} loading={syncing} onClick={sync} variant="secondary">
              Sync posts
            </Button>
          )
        }
      />

      {instagram?.needsReconnect && (
        <div className="animate-in mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px]">
            Instagram rejected the saved access token. Automation is paused until you reconnect.
          </p>
          <LinkButton to="/settings" size="sm">
            Reconnect
          </LinkButton>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[152px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="animate-in grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={MessageSquare}
              label="Awaiting reply"
              value={totals.pending}
              sub={totals.pending ? "Open in the inbox" : "All caught up"}
              tone={totals.pending ? "amber" : "emerald"}
              to="/inbox"
            />
            <StatCard
              icon={Bot}
              label="AI replies sent"
              value={totals.aiReplies}
              sub={`${totals.manualReplies} sent manually`}
              tone="brand"
            />
            <StatCard
              icon={CheckCircle2}
              label="Response rate"
              value={`${totals.responseRate}%`}
              sub={`${totals.replied} of ${totals.comments} comments`}
              tone="emerald"
            />
            <StatCard
              icon={Images}
              label="Posts automated"
              value={`${totals.automatedPosts}/${totals.posts}`}
              sub={`${totals.postsWithContext} have context`}
              tone="slate"
              to="/posts"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Last 14 days"
                  description="Comments received against replies sent."
                />
                <div className="p-5">
                  <ActivityChart series={data.series} />
                </div>
              </Card>

              <OnboardingCard
                instagram={instagram}
                totals={totals}
                onSync={sync}
                syncing={syncing}
              />

              {data.needsAttention?.length > 0 && (
                <Card>
                  <CardHeader
                    title="Failed replies"
                    description="These could not be posted to Instagram."
                    action={
                      <LinkButton to="/inbox?status=failed" size="sm" variant="ghost">
                        View all
                      </LinkButton>
                    }
                  />
                  <ul className="divide-y divide-[var(--border)]">
                    {data.needsAttention.map((c) => (
                      <li key={c.id} className="px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            className="mt-0.5 size-4 shrink-0 text-red-500"
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="text-[13px]">
                              <span className="font-medium">@{c.username || "unknown"}</span>{" "}
                              <span className="text-muted">{truncate(c.text, 90)}</span>
                            </p>
                            <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">
                              {truncate(c.error, 120)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <Card className="h-fit">
              <CardHeader title="Recent activity" />
              {data.recentActivity.length ? (
                <ul className="divide-y divide-[var(--border)]">
                  {data.recentActivity.map((item) => {
                    const cfg = ACTIVITY_ICONS[item.type] || {
                      icon: Sparkles,
                      tone: "text-[var(--text-subtle)]",
                    };
                    const Icon = cfg.icon;
                    return (
                      <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                        <Icon className={cx("mt-0.5 size-4 shrink-0", cfg.tone)} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug">{item.message}</p>
                          <p className="mt-0.5 text-[11.5px] text-subtle">
                            {timeAgo(item.createdAt)}
                          </p>
                        </div>
                        {item.meta?.fallback && (
                          <Badge tone="warning" className="mt-0.5">
                            fallback
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="Nothing yet"
                  description="Activity shows up here once you connect Instagram and sync posts."
                />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
