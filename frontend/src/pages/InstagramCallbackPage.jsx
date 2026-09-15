import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, Card, useToast } from "../components/ui";
import Logo from "../components/Logo";

/**
 * Lands here after Instagram redirects back with ?code=. The code is exchanged
 * server-side (the app secret never reaches the browser) and then we bounce to
 * the dashboard.
 */
export default function InstagramCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshMe, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();

  const [state, setState] = useState({ status: "working", message: "Finishing the connection..." });
  // StrictMode double-invokes effects in dev; an auth code can only be spent once.
  const exchanged = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate("/login", { replace: true, state: { from: `/auth/instagram/callback${window.location.search}` } });
      return;
    }

    const error = params.get("error_description") || params.get("error");
    if (error) {
      setState({ status: "error", message: error });
      return;
    }

    const code = params.get("code");
    if (!code) {
      setState({ status: "error", message: "Instagram did not return an authorization code." });
      return;
    }

    const oauthState = params.get("state");
    if (!oauthState) {
      setState({
        status: "error",
        message: "Instagram did not return a valid connection state. Please try again.",
      });
      return;
    }

    if (exchanged.current) return;
    exchanged.current = true;

    api.instagram
      .connect({
        code,
        state: oauthState,
        redirectUri: `${window.location.origin}/auth/instagram/callback`,
      })
      .then(async (result) => {
        await refreshMe().catch(() => {});
        setState({ status: "done", message: `Connected @${result.instagram.username}` });
        toast.success("Instagram connected", "Sync your posts to get started.");
        setTimeout(() => navigate("/", { replace: true }), 900);
      })
      .catch((e) => {
        setState({ status: "error", message: e.message });
      });
  }, [isAuthenticated, isLoading, params, navigate, refreshMe, toast]);

  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="mt-8">
          {state.status === "working" && (
            <>
              <Loader2 className="mx-auto size-8 animate-spin text-brand-600 dark:text-brand-400" />
              <h1 className="mt-5 text-[17px] font-semibold">Connecting Instagram</h1>
              <p className="mt-1.5 text-[13.5px] text-muted">{state.message}</p>
            </>
          )}

          {state.status === "done" && (
            <>
              <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
              <h1 className="mt-5 text-[17px] font-semibold">All set</h1>
              <p className="mt-1.5 text-[13.5px] text-muted">{state.message}</p>
            </>
          )}

          {state.status === "error" && (
            <>
              <AlertTriangle className="mx-auto size-8 text-amber-500" />
              <h1 className="mt-5 text-[17px] font-semibold">Could not connect</h1>
              <p className="mt-1.5 break-words text-[13.5px] text-muted">{state.message}</p>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => navigate("/settings", { replace: true })}>
                  Back to settings
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
