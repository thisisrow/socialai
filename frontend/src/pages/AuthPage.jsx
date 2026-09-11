import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, Clock, Eye, EyeOff, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button, Field, Input, useToast } from "../components/ui";
import Logo from "../components/Logo";

const HIGHLIGHTS = [
  {
    icon: Bot,
    title: "Replies that stay on-message",
    body: "Claude answers only from the context you write for each post, so it never invents prices or hours.",
  },
  {
    icon: Clock,
    title: "Answer in seconds, not hours",
    body: "New comments arrive by webhook and get a reply while the person is still on your page.",
  },
  {
    icon: CheckCircle2,
    title: "You stay in control",
    body: "Turn automation on per post, review every reply, and take over any conversation by hand.",
  },
];

function ShowcasePanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.25) 0, transparent 40%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
          <Sparkles className="size-3.5" aria-hidden />
          Powered by Claude
        </span>
        <h2 className="mt-7 max-w-md text-[34px] font-bold leading-[1.15] text-white">
          Never leave an Instagram comment unanswered.
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
          SocialAI watches your posts, drafts an on-brand reply from the context you supply, and posts
          it for you. Every conversation stays in one inbox.
        </p>
      </div>

      <ul className="relative mt-10 space-y-5">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Icon className="size-4 text-white" aria-hidden />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">{title}</p>
              <p className="mt-0.5 max-w-sm text-[13px] leading-relaxed text-white/70">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="relative mt-10 text-[12px] text-white/50">
        SocialAI is not affiliated with Meta or Instagram.
      </p>
    </div>
  );
}

export default function AuthPage({ mode = "login" }) {
  const isSignup = mode === "signup";
  const { login, signup, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  // Mirrors the server rules so the user is told before a round trip.
  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      next.email = "Enter a valid email address";

    if (!form.password) next.password = "Password is required";
    else if (isSignup) {
      if (form.password.length < 8) next.password = "Use at least 8 characters";
      else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))
        next.password = "Include at least one letter and one number";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isSignup) {
        await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
        toast.success("Welcome to SocialAI", "Connect Instagram to start syncing posts.");
      } else {
        await login({ email: form.email.trim(), password: form.password });
        toast.success("Signed in");
      }
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      // Field-level where the server told us which field, form-level otherwise.
      if (err.code === "email_taken") setErrors({ email: err.message });
      else if (err.details?.field) setErrors({ [err.details.field]: err.message });
      else setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo size="lg" />

          <h1 className="mt-9 text-[26px] font-bold leading-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-[14px] text-muted">
            {isSignup
              ? "Set up AI comment replies for your Instagram in a couple of minutes."
              : "Sign in to your SocialAI workspace."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {errors.form && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-700 dark:text-red-400"
              >
                {errors.form}
              </div>
            )}

            {isSignup && (
              <Field label="Name" hint="Shown on your account. Optional.">
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder="Alex Rivera"
                  value={form.name}
                  onChange={set("name")}
                />
              </Field>
            )}

            <Field label="Email" required error={errors.email}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={set("email")}
                invalid={Boolean(errors.email)}
                required
              />
            </Field>

            <Field
              label="Password"
              required
              error={errors.password}
              hint={isSignup ? "At least 8 characters, with a letter and a number." : undefined}
            >
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  invalid={Boolean(errors.password)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              size="lg"
              loading={submitting || isLoading}
              className="w-full"
              icon={submitting ? undefined : ArrowRight}
            >
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-muted">
            {isSignup ? "Already have an account? " : "New to SocialAI? "}
            <Link
              to={isSignup ? "/login" : "/signup"}
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>

      <ShowcasePanel />
    </div>
  );
}
