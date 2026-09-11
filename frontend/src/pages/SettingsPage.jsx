import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Instagram,
  KeyRound,
  Link2,
  LogOut,
  Moon,
  Save,
  Sun,
  Unlink,
  User,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  Switch,
  useToast,
} from "../components/ui";
import PageHeader from "../components/layout/PageHeader";
import { formatDate, formatDateTime } from "../lib/format";

/** Keyed by user id at the call site, so the name field initialises once the
 *  profile has loaded without mirroring the prop into state on every change. */
function ProfileCard() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.auth.updateProfile({ name: name.trim() });
      setUser(result.user);
      toast.success("Profile updated");
    } catch (e) {
      toast.error("Could not update profile", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Profile" description="How your account appears in SocialAI." />
      <div className="space-y-4 p-5">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" />
        </Field>
        <Field label="Email" hint="Email cannot be changed yet.">
          <Input value={user?.email || ""} disabled readOnly />
        </Field>
        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px] text-subtle">
            Member since {formatDate(user?.createdAt)}
          </p>
          <Button
            icon={Save}
            loading={saving}
            disabled={name.trim() === (user?.name || "")}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InstagramCard() {
  const { instagram, refreshMe } = useAuth();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [purge, setPurge] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      // The redirect URI must match what is registered in the Meta app, so the
      // server owns it and the browser just follows where it is told.
      const redirectUri = `${window.location.origin}/auth/instagram/callback`;
      const { url } = await api.instagram.authorizeUrl(redirectUri);
      window.location.href = url;
    } catch (e) {
      toast.error("Could not start the Instagram flow", e.message);
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await api.instagram.disconnect(purge);
      await refreshMe();
      toast.success("Instagram disconnected", purge ? "Synced posts and comments were removed." : undefined);
      setConfirmDisconnect(false);
    } catch (e) {
      toast.error("Could not disconnect", e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Instagram connection"
          description="The professional account SocialAI manages comments for."
          action={
            instagram?.connected ? (
              instagram.needsReconnect ? (
                <Badge tone="warning" icon={AlertTriangle}>
                  Reconnect needed
                </Badge>
              ) : (
                <Badge tone="success" icon={CheckCircle2}>
                  Connected
                </Badge>
              )
            ) : (
              <Badge>Not connected</Badge>
            )
          }
        />

        <div className="p-5">
          {instagram?.connected ? (
            <>
              <div className="flex items-center gap-4">
                {instagram.profilePictureUrl ? (
                  <img
                    src={instagram.profilePictureUrl}
                    alt=""
                    className="size-14 rounded-full object-cover ring-2 ring-[var(--border)]"
                  />
                ) : (
                  <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-amber-500 text-white">
                    <Instagram className="size-6" aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">@{instagram.username}</p>
                  <p className="text-[12.5px] capitalize text-muted">
                    {(instagram.accountType || "professional").toLowerCase()} account
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                {[
                  ["Connected", formatDate(instagram.connectedAt)],
                  ["Last sync", instagram.lastSyncedAt ? formatDateTime(instagram.lastSyncedAt) : "Never"],
                  [
                    "Token expires",
                    instagram.tokenExpiresAt ? formatDate(instagram.tokenExpiresAt) : "Unknown",
                  ],
                  ["Followers", (instagram.followersCount || 0).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11.5px] uppercase tracking-wide text-subtle">{label}</dt>
                    <dd className="mt-0.5 text-[13px] font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {instagram.lastError && (
                <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
                  {instagram.lastError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                <Button variant="secondary" icon={Link2} loading={connecting} onClick={connect}>
                  Reconnect
                </Button>
                <Button variant="outlineDanger" icon={Unlink} onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-amber-500 text-white">
                <Instagram className="size-6" aria-hidden />
              </span>
              <h4 className="mt-4 text-[15px] font-semibold">Connect your Instagram</h4>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted">
                SocialAI needs a professional (Business or Creator) account to read and reply to
                comments. You will be sent to Instagram to approve access.
              </p>
              <Button className="mt-5" icon={Instagram} loading={connecting} onClick={connect}>
                Connect Instagram
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Disconnect Instagram?"
        description="Automation stops immediately and no further comments will be answered."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={disconnecting} onClick={disconnect}>
              Disconnect
            </Button>
          </>
        }
      >
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3.5">
          <Switch checked={purge} onChange={setPurge} label="Delete synced data" />
          <span>
            <span className="block text-[13px] font-medium">Also delete synced data</span>
            <span className="mt-0.5 block text-[12px] text-muted">
              Removes every synced post, saved context and comment history. This cannot be undone.
            </span>
          </span>
        </label>
      </Modal>
    </>
  );
}

function SecurityCard() {
  const { logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError("The new passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.auth.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // The server rotates tokens and returns a fresh pair, so this session survives.
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password changed", "All other devices have been signed out.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    try {
      await api.auth.logoutEverywhere();
      toast.success("Signed out everywhere");
      await logout();
    } catch (e) {
      toast.error("Could not sign out everywhere", e.message);
      setSigningOut(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Security" description="Change your password or end every session." />
      <form onSubmit={submit} className="space-y-4 p-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-700 dark:text-red-400"
          >
            {error}
          </div>
        )}
        <Field label="Current password" required>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={set("currentPassword")}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" required hint="8+ characters, a letter and a number.">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={set("newPassword")}
              required
            />
          </Field>
          <Field label="Confirm new password" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set("confirm")}
              required
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="ghost"
            icon={LogOut}
            loading={signingOut}
            onClick={signOutEverywhere}
          >
            Sign out everywhere
          </Button>
          <Button
            type="submit"
            icon={KeyRound}
            loading={saving}
            disabled={!form.currentPassword || !form.newPassword}
          >
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader title="Appearance" description="Applies to this browser only." />
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {[
          { value: "light", label: "Light", icon: Sun },
          { value: "dark", label: "Dark", icon: Moon },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
              theme === value
                ? "border-brand-500 bg-brand-500/8"
                : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--bg-subtle)]">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="flex-1 text-[13.5px] font-medium">{label}</span>
            {theme === value && <CheckCircle2 className="size-4 text-brand-600 dark:text-brand-400" />}
          </button>
        ))}
      </div>
    </Card>
  );
}

function ProfileCardWrapper() {
  const { user } = useAuth();
  return <ProfileCard key={user?.id || "anon"} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[880px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Settings"
        description="Manage your account, Instagram connection and appearance."
      />
      <div className="space-y-6">
        <InstagramCard />
        <ProfileCardWrapper />
        <SecurityCard />
        <AppearanceCard />
        <p className="flex items-center justify-center gap-1.5 pb-4 text-[11.5px] text-subtle">
          <User className="size-3" aria-hidden />
          SocialAI is not affiliated with Meta or Instagram.
        </p>
      </div>
    </div>
  );
}
