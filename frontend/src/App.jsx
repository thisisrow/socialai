import { useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/ui";
import AppShell from "./components/layout/AppShell";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import PostsPage from "./pages/PostsPage";
import InboxPage from "./pages/InboxPage";
import AutomationPage from "./pages/AutomationPage";
import SettingsPage from "./pages/SettingsPage";
import InstagramCallbackPage from "./pages/InstagramCallbackPage";
import Logo from "./components/Logo";

function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <Logo size="lg" />
        <Loader2 className="size-5 animate-spin text-[var(--text-subtle)]" aria-label="Loading" />
      </div>
    </div>
  );
}

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

function AuthedRoutes() {
  // The inbox badge is owned here so Dashboard and Inbox can both refresh it.
  const [counts, setCounts] = useState({ pending: 0 });
  const onCountsChange = (next) => setCounts((c) => ({ ...c, ...next }));

  return (
    <Routes>
      <Route element={<AppShell pendingCount={counts.pending} />}>
        <Route index element={<DashboardPage onCountsChange={onCountsChange} />} />
        <Route path="inbox" element={<InboxPage onCountsChange={onCountsChange} />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="automation" element={<AutomationPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
              <Route path="/auth/instagram/callback" element={<InstagramCallbackPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/*" element={<AuthedRoutes />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
