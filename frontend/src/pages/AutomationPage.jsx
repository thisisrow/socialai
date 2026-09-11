import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, PlugZap, Save, Send, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from "../components/ui";
import PageHeader from "../components/layout/PageHeader";
import { cx } from "../lib/format";

const TONE_LABELS = {
  friendly: "Friendly - warm and personal",
  professional: "Professional - polished, no slang",
  playful: "Playful - light and a bit cheeky",
  concise: "Concise - as few words as possible",
  enthusiastic: "Enthusiastic - upbeat and energetic",
};

const SAMPLE_COMMENTS = [
  "Do you ship internationally?",
  "How much is this?",
  "What time do you open on Sundays?",
  "This looks amazing!",
];

export default function AutomationPage() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [original, setOriginal] = useState(null);
  const [meta, setMeta] = useState({ model: "", configured: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [testComment, setTestComment] = useState(SAMPLE_COMMENTS[0]);
  const [testContext, setTestContext] = useState("");
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.ai
      .getSettings()
      .then((data) => {
        setSettings(data.settings);
        setOriginal(data.settings);
        setMeta({ model: data.model, configured: data.configured });
        setTestContext(data.settings.globalContext || "");
      })
      .catch((e) => toast.error("Could not load AI settings", e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(original),
    [settings, original],
  );

  const set = (key) => (value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.ai.saveSettings(settings);
      setSettings(result.settings);
      setOriginal(result.settings);
      toast.success("Brand voice saved", "New replies use these settings straight away.");
    } catch (e) {
      toast.error("Could not save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!testComment.trim()) return;
    setTesting(true);
    try {
      // Save first when there are unsaved edits, so the preview reflects them.
      if (dirty) {
        const result = await api.ai.saveSettings(settings);
        setSettings(result.settings);
        setOriginal(result.settings);
      }
      const result = await api.ai.preview({ comment: testComment, context: testContext });
      setPreview(result);
    } catch (e) {
      toast.error("Preview failed", e.message);
    } finally {
      setTesting(false);
    }
  };

  const checkConnection = async () => {
    setChecking(true);
    try {
      setConnection(await api.ai.test());
    } catch (e) {
      setConnection({ ok: false, error: e.message });
    } finally {
      setChecking(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader title="AI Automation" description="Teach Claude how your brand speaks." />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-[560px]" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="AI Automation"
        description="Teach Claude how your brand speaks. These settings apply to every automated reply."
        actions={
          <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      {!meta.configured && (
        <div className="animate-in mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px]">
            <span className="font-medium">ANTHROPIC_API_KEY is not set on the server.</span> Replies
            will use your fallback message until it is configured.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Your business"
              description="Background Claude may draw on for every reply."
            />
            <div className="space-y-4 p-5">
              <Field label="Business name">
                <Input
                  value={settings.businessName}
                  onChange={(e) => set("businessName")(e.target.value)}
                  placeholder="Rumo Restaurant"
                />
              </Field>
              <Field
                label="What you do"
                hint="One or two lines. This is background, not a source of specific facts."
              >
                <Textarea
                  rows={3}
                  value={settings.businessDescription}
                  onChange={(e) => set("businessDescription")(e.target.value)}
                  placeholder="A neighbourhood Italian kitchen in Lisbon, open for lunch and dinner."
                />
              </Field>
              <Field
                label="Default context"
                hint="Used for posts that have no context of their own. Facts only."
              >
                <Textarea
                  rows={5}
                  value={settings.globalContext}
                  onChange={(e) => set("globalContext")(e.target.value)}
                  placeholder={"Open 11am-11pm daily.\nTakeaway available, no delivery.\nBookings via the link in bio."}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Voice" description="How replies should sound." />
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tone">
                  <Select value={settings.tone} onChange={(e) => set("tone")(e.target.value)}>
                    {Object.entries(TONE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Language" hint="Replies are written in this language.">
                  <Input
                    value={settings.language}
                    onChange={(e) => set("language")(e.target.value)}
                    placeholder="English"
                  />
                </Field>
              </div>

              <Field label="Reply length">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={settings.maxSentences}
                    onChange={(e) => set("maxSentences")(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-brand-600"
                  />
                  <span className="w-24 shrink-0 text-[13px] tabular-nums text-muted">
                    {settings.maxSentences} sentence{settings.maxSentences === 1 ? "" : "s"}
                  </span>
                </div>
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-medium">Allow emojis</p>
                  <p className="mt-0.5 text-[12px] text-subtle">At most one, where it fits.</p>
                </div>
                <Switch checked={settings.useEmojis} onChange={set("useEmojis")} label="Allow emojis" />
              </div>

              <Field label="Signature" hint="Appended to every reply. Leave blank for none.">
                <Input
                  value={settings.signature}
                  onChange={(e) => set("signature")(e.target.value)}
                  placeholder="- Team Rumo"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Guardrails" description="What happens when Claude cannot answer." />
            <div className="space-y-4 p-5">
              <Field
                label="Fallback message"
                hint="Sent verbatim when the context does not answer the comment. This is what stops it inventing details."
              >
                <Textarea
                  rows={2}
                  value={settings.fallbackMessage}
                  onChange={(e) => set("fallbackMessage")(e.target.value)}
                />
              </Field>
              <Field label="Extra instructions" hint="Anything else Claude should always do or avoid.">
                <Textarea
                  rows={3}
                  value={settings.customInstructions}
                  onChange={(e) => set("customInstructions")(e.target.value)}
                  placeholder="Never quote prices. Point people to the link in bio for bookings."
                />
              </Field>
              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3">
                <div className="pr-4">
                  <p className="text-[13px] font-medium">Auto-reply on new posts</p>
                  <p className="mt-0.5 text-[12px] text-subtle">
                    Newly synced posts start with automation switched on.
                  </p>
                </div>
                <Switch
                  checked={settings.autoReplyByDefault}
                  onChange={set("autoReplyByDefault")}
                  label="Auto-reply on new posts"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader
              title="Playground"
              description="Try a comment against your settings. Nothing is posted."
              action={<Badge tone="brand" icon={Bot}>{meta.model}</Badge>}
            />
            <div className="space-y-3.5 p-5">
              <Field label="Comment">
                <Input
                  value={testComment}
                  onChange={(e) => setTestComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runPreview()}
                  placeholder="Do you ship internationally?"
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_COMMENTS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setTestComment(sample)}
                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-brand-500 hover:text-[var(--text)]"
                  >
                    {sample}
                  </button>
                ))}
              </div>
              <Field label="Context to test against">
                <Textarea
                  rows={4}
                  value={testContext}
                  onChange={(e) => setTestContext(e.target.value)}
                  placeholder="Leave blank to use your default context."
                />
              </Field>

              <Button className="w-full" icon={Send} loading={testing} onClick={runPreview}>
                {dirty ? "Save & preview" : "Generate reply"}
              </Button>

              {preview && (
                <div
                  className={cx(
                    "rounded-xl border px-3.5 py-3",
                    preview.ok
                      ? "border-emerald-500/30 bg-emerald-500/8"
                      : "border-amber-500/30 bg-amber-500/8",
                  )}
                >
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                    <Sparkles className="size-3" aria-hidden />
                    {preview.ok ? "Reply" : "Fallback"}
                  </p>
                  <p className="text-[13.5px] leading-relaxed">{preview.reply}</p>
                  <p className="mt-2 text-[11px] text-subtle">
                    {preview.ok
                      ? `${preview.latencyMs}ms - ${preview.usage?.inputTokens ?? 0} in / ${preview.usage?.outputTokens ?? 0} out tokens`
                      : preview.error}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Claude connection" description="Check the server key is working." />
            <div className="p-5">
              <Button
                variant="secondary"
                className="w-full"
                icon={PlugZap}
                loading={checking}
                onClick={checkConnection}
              >
                Test connection
              </Button>
              {connection && (
                <div
                  className={cx(
                    "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px]",
                    connection.ok
                      ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
                      : "border-red-500/30 bg-red-500/8 text-red-700 dark:text-red-400",
                  )}
                >
                  {connection.ok ? (
                    <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 break-words">
                    {connection.ok
                      ? `${connection.model} responded correctly.`
                      : connection.error}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
