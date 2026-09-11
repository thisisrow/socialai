import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Instagram,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  SearchInput,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from "../components/ui";
import PageHeader from "../components/layout/PageHeader";
import { cx, initialsOf, timeAgo, truncate } from "../lib/format";

const STATUS_META = {
  pending: { label: "Awaiting reply", tone: "warning", icon: Inbox },
  replied: { label: "Replied", tone: "success", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "danger", icon: AlertTriangle },
  skipped: { label: "Skipped", tone: "neutral", icon: X },
};

function CommentRow({ comment, selected, onSelect }) {
  const meta = STATUS_META[comment.status] || STATUS_META.pending;
  return (
    <button
      type="button"
      onClick={() => onSelect(comment)}
      className={cx(
        "flex w-full gap-3 border-l-2 px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-brand-600 bg-brand-500/8"
          : "border-transparent hover:bg-[var(--surface-hover)]",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[10px] font-bold text-white">
        {initialsOf(comment.username)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold">@{comment.username || "unknown"}</span>
          <span className="ml-auto shrink-0 text-[11px] text-subtle">
            {timeAgo(comment.commentedAt)}
          </span>
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[12.5px] leading-relaxed text-muted">
          {comment.text || "(no text)"}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {comment.replyMode === "ai" && <Badge tone="brand">AI</Badge>}
        </span>
      </span>
      {comment.post?.thumbnailUrl && (
        <img
          src={comment.post.thumbnailUrl}
          alt=""
          className="size-10 shrink-0 rounded-lg object-cover"
        />
      )}
    </button>
  );
}

/** Keyed by comment id at the call site, so switching comments remounts this
 *  and clears the draft without a prop-to-state effect. */
function ConversationPanel({ comment, onUpdated }) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftNote, setDraftNote] = useState(null);
  const textareaRef = useRef(null);

  if (!comment) {
    return (
      <div className="hidden h-full place-items-center lg:grid">
        <EmptyState
          icon={Inbox}
          title="Select a comment"
          description="Pick a conversation on the left to read it and reply."
        />
      </div>
    );
  }

  const generate = async () => {
    setDrafting(true);
    setDraftNote(null);
    try {
      const result = await api.comments.draft(comment.id);
      setDraft(result.draft || "");
      setDraftNote(result.ok ? null : result.error);
      textareaRef.current?.focus();
      if (!result.ok) toast.info("Fallback used", result.error);
    } catch (e) {
      toast.error("Could not draft a reply", e.message);
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    const message = draft.trim();
    if (!message) return;
    setSending(true);
    try {
      const result = await api.comments.reply(comment.id, message);
      toast.success("Reply posted to Instagram");
      onUpdated(result.comment);
      setDraft("");
    } catch (e) {
      toast.error("Reply failed", e.message);
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (action) => {
    try {
      const result = action === "skip" ? await api.comments.skip(comment.id) : await api.comments.reopen(comment.id);
      onUpdated({ ...comment, ...result.comment, post: comment.post });
      toast.success(action === "skip" ? "Marked as skipped" : "Moved back to pending");
    } catch (e) {
      toast.error("Could not update", e.message);
    }
  };

  const canReply = comment.status !== "replied";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[var(--border)] p-4">
        {comment.post?.thumbnailUrl && (
          <img
            src={comment.post.thumbnailUrl}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] leading-relaxed">
            {comment.post?.caption || <span className="text-subtle">No caption</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {comment.post?.autoReplyEnabled ? (
              <Badge tone="brand">Auto-reply on</Badge>
            ) : (
              <Badge>Manual only</Badge>
            )}
            {comment.post && !comment.post.hasContext && <Badge tone="warning">No context</Badge>}
          </div>
        </div>
        {comment.post?.permalink && (
          <a
            href={comment.post.permalink}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            aria-label="Open post on Instagram"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[10px] font-bold text-white">
            {initialsOf(comment.username)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[12px] text-subtle">
              <span className="font-semibold text-[var(--text)]">@{comment.username || "unknown"}</span>{" "}
              {timeAgo(comment.commentedAt)}
            </p>
            <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[13.5px] leading-relaxed">
              {comment.text || "(no text)"}
            </div>
          </div>
        </div>

        {comment.replyText && (
          <div className="flex flex-row-reverse gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-right text-[12px] text-subtle">
                {comment.replyMode === "ai" ? "AI reply" : "Your reply"} - {timeAgo(comment.repliedAt)}
              </p>
              <div className="rounded-2xl rounded-tr-sm bg-brand-600 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">
                {comment.replyText}
              </div>
            </div>
          </div>
        )}

        {comment.status === "failed" && comment.error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="size-3.5" aria-hidden />
              Instagram rejected this reply
            </p>
            <p className="mt-1 text-[12px] text-red-600/90 dark:text-red-400/80">{comment.error}</p>
          </div>
        )}
      </div>

      {canReply ? (
        <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] p-4">
          {draftNote && (
            <p className="mb-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-700 dark:text-amber-400">
              {draftNote}
            </p>
          )}
          <Textarea
            ref={textareaRef}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply, or let Claude draft one..."
            className="bg-[var(--surface)]"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
            }}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={Sparkles} loading={drafting} onClick={generate}>
              Draft with AI
            </Button>
            {comment.status === "pending" && (
              <Button size="sm" variant="ghost" icon={X} onClick={() => changeStatus("skip")}>
                Skip
              </Button>
            )}
            {comment.status === "failed" && (
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => changeStatus("reopen")}>
                Reopen
              </Button>
            )}
            <Button
              size="sm"
              icon={Send}
              className="ml-auto"
              loading={sending}
              disabled={!draft.trim()}
              onClick={send}
            >
              Send reply
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-subtle">Ctrl/Cmd + Enter to send.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3.5 text-[12.5px] text-muted">
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
          Replied {timeAgo(comment.repliedAt)}. Instagram allows one reply per comment thread.
        </div>
      )}
    </div>
  );
}

export default function InboxPage({ onCountsChange }) {
  const { instagram } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const status = params.get("status") || "pending";
  const [comments, setComments] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(
    async (nextStatus, term) => {
      setLoading(true);
      try {
        const data = await api.comments.list({ status: nextStatus, search: term, limit: 60 });
        setComments(data.comments);
        setCounts(data.counts);
        onCountsChange?.({ pending: data.counts.pending || 0 });
        // Keep whatever is open if it survived the filter, else open the first.
        setSelected((current) => {
          const stillThere = data.comments.find((c) => c.id === current?.id);
          return stillThere || data.comments[0] || null;
        });
      } catch (e) {
        toast.error("Could not load the inbox", e.message);
      } finally {
        setLoading(false);
      }
    },
    // toast and onCountsChange are stable for this component's lifetime;
    // including them would re-create the callback and re-fire the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => load(status, search.trim()), search ? 320 : 0);
    return () => clearTimeout(id);
  }, [status, search, load]);

  const onUpdated = (updated) => {
    setComments((list) => list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setSelected((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
    // Status changed, so the tab counts are stale.
    load(status, search.trim());
  };

  if (!instagram?.connected) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader title="Inbox" description="Every comment on your posts, in one place." />
        <Card>
          <EmptyState
            icon={Instagram}
            title="Connect Instagram first"
            description="Once connected, new comments land here automatically."
            action={<LinkButton to="/settings" variant="primary">Go to Settings</LinkButton>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Inbox"
        description="Review comments, send an AI draft, or write the reply yourself."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={status}
          onChange={(next) => setParams(next === "pending" ? {} : { status: next })}
          tabs={[
            { value: "pending", label: "Awaiting", count: counts.pending || 0 },
            { value: "replied", label: "Replied", count: counts.replied || 0 },
            { value: "failed", label: "Failed", count: counts.failed || 0 },
            { value: "skipped", label: "Skipped", count: counts.skipped || 0 },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search comments or handles..."
          className="ml-auto w-full sm:w-72"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="grid lg:h-[calc(100dvh-260px)] lg:min-h-[520px] lg:grid-cols-[minmax(320px,380px)_1fr]">
          <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
            <div className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto lg:max-h-none lg:h-full">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : comments.length ? (
                comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    selected={selected?.id === c.id}
                    onSelect={setSelected}
                  />
                ))
              ) : (
                <EmptyState
                  icon={status === "pending" ? CheckCircle2 : Inbox}
                  title={
                    search
                      ? "Nothing matches that search"
                      : status === "pending"
                        ? "Inbox zero"
                        : `No ${status} comments`
                  }
                  description={
                    search
                      ? "Try a different term."
                      : status === "pending"
                        ? "Every comment has been handled. New ones appear here as they arrive."
                        : undefined
                  }
                />
              )}
            </div>
          </div>

          <div className="min-h-[380px]">
            <ConversationPanel key={selected?.id || "none"} comment={selected} onUpdated={onUpdated} />
          </div>
        </div>
      </Card>

      {selected && (
        <p className="mt-3 text-center text-[11.5px] text-subtle lg:hidden">
          Showing: {truncate(selected.text, 60)}
        </p>
      )}
    </div>
  );
}
