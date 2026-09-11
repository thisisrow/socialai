import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  Film,
  Images,
  Instagram,
  Layers,
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
  EmptyState,
  LinkButton,
  Modal,
  SearchInput,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from "../components/ui";
import PageHeader from "../components/layout/PageHeader";
import { cx, formatDate, truncate } from "../lib/format";

function PostMedia({ post }) {
  const [failed, setFailed] = useState(false);
  const src = post.thumbnailUrl || post.mediaUrl;

  if (!src || failed) {
    return (
      <div className="grid aspect-square place-items-center bg-[var(--bg-subtle)]">
        {post.mediaType === "VIDEO" ? (
          <Film className="size-7 text-[var(--text-subtle)]" aria-hidden />
        ) : (
          <Images className="size-7 text-[var(--text-subtle)]" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={post.caption ? truncate(post.caption, 80) : "Instagram post"}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
    />
  );
}

function PostCard({ post, onOpenContext, onToggle, busy }) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <div className="relative overflow-hidden">
        <PostMedia post={post} />

        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {post.autoReplyEnabled && (
            <Badge tone="brand" icon={Zap} className="bg-[var(--surface)]/95 backdrop-blur">
              Auto
            </Badge>
          )}
          {post.pendingComments > 0 && (
            <Badge tone="warning" className="bg-[var(--surface)]/95 backdrop-blur">
              {post.pendingComments} new
            </Badge>
          )}
        </div>

        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on Instagram"
            className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-lg bg-black/45 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/65 group-hover:opacity-100"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed">
          {post.caption || <span className="text-subtle">No caption</span>}
        </p>

        <div className="mt-3 flex items-center gap-3 text-[11.5px] text-subtle">
          <span>{formatDate(post.postedAt)}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" aria-hidden />
            {post.commentsCount}
          </span>
          {post.repliesSent > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3" aria-hidden />
              {post.repliesSent}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3.5">
          <button
            type="button"
            onClick={() => onOpenContext(post)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-medium transition-colors",
              post.hasContext
                ? "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <FileText className="size-3.5" aria-hidden />
            {post.hasContext ? "Context set" : "Add context"}
          </button>

          <label className="flex items-center gap-2">
            <span className="text-[11.5px] text-muted">Auto-reply</span>
            <Switch
              size="sm"
              checked={post.autoReplyEnabled}
              disabled={busy}
              onChange={(next) => onToggle(post, next)}
              label={`Auto-reply for post ${post.mediaId}`}
            />
          </label>
        </div>

        {post.autoReplyEnabled && !post.hasContext && (
          <p className="mt-2.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-700 dark:text-amber-400">
            No context yet, so replies fall back to your default message.
          </p>
        )}
      </div>
    </Card>
  );
}

/** Keyed by mediaId at the call site so each post opens with its own draft. */
function ContextModal({ post, onClose, onSaved }) {
  const toast = useToast();
  const [draft, setDraft] = useState(post?.context || "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [testComment, setTestComment] = useState("Do you deliver?");
  const [testing, setTesting] = useState(false);

  if (!post) return null;

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.posts.setContext(post.mediaId, draft.trim());
      toast.success(result.hasContext ? "Context saved" : "Context cleared");
      onSaved({ ...post, context: result.context, hasContext: result.hasContext });
      onClose();
    } catch (e) {
      toast.error("Could not save context", e.message);
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!testComment.trim()) return;
    setTesting(true);
    try {
      const result = await api.ai.preview({ comment: testComment, context: draft });
      setPreview(result);
      if (!result.ok) toast.error("Claude could not answer", result.error);
    } catch (e) {
      toast.error("Preview failed", e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Post context"
      description="Claude may only use these facts when it answers comments on this post."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save context
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {(post.thumbnailUrl || post.mediaUrl) && (
          <div className="flex gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
            <img
              src={post.thumbnailUrl || post.mediaUrl}
              alt=""
              className="size-16 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="line-clamp-3 text-[13px] leading-relaxed">
                {post.caption || <span className="text-subtle">No caption</span>}
              </p>
              <p className="mt-1 text-[11.5px] text-subtle">{formatDate(post.postedAt)}</p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[13px] font-medium" htmlFor="context-draft">
            Context
          </label>
          <Textarea
            id="context-draft"
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              "Example:\nOpen 11am-11pm daily.\nTakeaway only, no delivery.\nThe pasta special is 12 EUR and runs on Fridays."
            }
          />
          <div className="mt-1.5 flex justify-between text-[11.5px] text-subtle">
            <span>Plain facts work best. One per line.</span>
            <span className="tabular-nums">{draft.length}/4000</span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Sparkles className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden />
            Try it out
          </p>
          <div className="flex gap-2">
            <input
              value={testComment}
              onChange={(e) => setTestComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runPreview()}
              placeholder="Type a comment a follower might leave..."
              className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[13px] placeholder:text-[var(--text-subtle)] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
            />
            <Button size="sm" variant="secondary" loading={testing} onClick={runPreview}>
              Preview
            </Button>
          </div>
          {preview && (
            <div
              className={cx(
                "mt-2.5 rounded-lg border px-3 py-2.5 text-[13px]",
                preview.ok
                  ? "border-emerald-500/30 bg-emerald-500/8"
                  : "border-amber-500/30 bg-amber-500/8",
              )}
            >
              <p className="leading-relaxed">{preview.reply}</p>
              <p className="mt-1.5 text-[11px] text-subtle">
                {preview.ok
                  ? `${preview.model} - ${preview.latencyMs}ms`
                  : `Fallback used: ${preview.error}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function PostsPage() {
  const { instagram, refreshMe } = useAuth();
  const toast = useToast();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [contextPost, setContextPost] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.posts.list({ limit: 100 });
      setPosts(data.posts);
    } catch (e) {
      toast.error("Could not load posts", e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await api.posts.sync();
      toast.success("Sync complete", `${result.posts} posts, ${result.commentsNew} new comments.`);
      await Promise.all([load(), refreshMe().catch(() => {})]);
    } catch (e) {
      toast.error("Sync failed", e.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggle = async (post, enabled) => {
    setBusyId(post.mediaId);
    // Optimistic: the switch should feel instant, and we roll back on failure.
    setPosts((list) =>
      list.map((p) => (p.mediaId === post.mediaId ? { ...p, autoReplyEnabled: enabled } : p)),
    );
    try {
      await api.posts.setAutomation(post.mediaId, enabled);
      toast.success(enabled ? "Auto-reply on" : "Auto-reply off", enabled ? "New comments on this post will be answered." : undefined);
    } catch (e) {
      setPosts((list) =>
        list.map((p) => (p.mediaId === post.mediaId ? { ...p, autoReplyEnabled: !enabled } : p)),
      );
      toast.error("Could not update automation", e.message);
    } finally {
      setBusyId(null);
    }
  };

  const bulk = async (enabled) => {
    try {
      const result = await api.posts.bulkAutomation(enabled);
      toast.success(`Auto-reply ${enabled ? "enabled" : "disabled"}`, `${result.updated} posts updated.`);
      load();
    } catch (e) {
      toast.error("Bulk update failed", e.message);
    }
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter === "on" && !p.autoReplyEnabled) return false;
      if (filter === "off" && p.autoReplyEnabled) return false;
      if (filter === "no-context" && p.hasContext) return false;
      if (term && !String(p.caption || "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [posts, filter, search]);

  const counts = useMemo(
    () => ({
      all: posts.length,
      on: posts.filter((p) => p.autoReplyEnabled).length,
      off: posts.filter((p) => !p.autoReplyEnabled).length,
      noContext: posts.filter((p) => !p.hasContext).length,
    }),
    [posts],
  );

  if (!instagram?.connected) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader title="Posts" description="Your synced Instagram media." />
        <Card>
          <EmptyState
            icon={Instagram}
            title="Connect Instagram first"
            description="Link your professional account and SocialAI will pull in your recent posts."
            action={<LinkButton to="/settings" variant="primary">Go to Settings</LinkButton>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Posts"
        description="Give each post the facts Claude may use, then switch on auto-reply."
        actions={
          <>
            <Button variant="ghost" icon={Layers} onClick={() => bulk(true)} size="md">
              Enable all
            </Button>
            <Button variant="secondary" icon={RefreshCw} loading={syncing} onClick={sync}>
              Sync
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "all", label: "All", count: counts.all },
            { value: "on", label: "Automated", count: counts.on },
            { value: "off", label: "Manual", count: counts.off },
            { value: "no-context", label: "No context", count: counts.noContext },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search captions..."
          className="ml-auto w-full sm:w-64"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-[360px]" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="animate-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((post) => (
            <PostCard
              key={post.mediaId}
              post={post}
              busy={busyId === post.mediaId}
              onToggle={toggle}
              onOpenContext={setContextPost}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Images}
            title={posts.length ? "No posts match this filter" : "No posts synced yet"}
            description={
              posts.length
                ? "Try a different tab or clear the search."
                : "Run a sync to pull your recent Instagram media into SocialAI."
            }
            action={
              posts.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button icon={RefreshCw} loading={syncing} onClick={sync}>
                  Sync posts
                </Button>
              )
            }
          />
        </Card>
      )}

      <ContextModal
        key={contextPost?.mediaId || "none"}
        post={contextPost}
        onClose={() => setContextPost(null)}
        onSaved={(updated) =>
          setPosts((list) => list.map((p) => (p.mediaId === updated.mediaId ? updated : p)))
        }
      />
    </div>
  );
}
