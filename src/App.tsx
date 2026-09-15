import { useEffect, type ReactNode } from "react";
import { checkBackend } from "./services/api";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";
import Landing from "./pages/Landing";
import { ForgotPasswordPage, LoginPage, SignupPage } from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Workspace from "./pages/Workspace";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import WorkspaceConfigure from "./pages/WorkspaceConfigure";
import WorkspacePreview from "./pages/WorkspacePreview";
import ImageGenerator from "./pages/ImageGenerator";
import Files from "./pages/Files";
import Recents from "./pages/Recents";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import Admin from "./pages/Admin";
import { Button } from "./components/ui";
import { EraLogo } from "./components/branding/EraLogo";

function Splash() {
  return (
    <div className="app-canvas flex min-h-screen flex-col items-center justify-center p-6 space-y-3">
      <EraLogo variant="full" size="lg" />
      <p className="text-xs font-semibold text-soft animate-pulse">Loading your workspace…</p>
    </div>
  );
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

function OnboardingGate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/signup" replace />;
  if (user.onboardingDone) return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
}

function AppGate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/signup" replace />;
  if (!user.onboardingDone) return <Navigate to="/onboarding" replace />;
  return <AppShell />;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="app-canvas flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-gradient text-[96px] leading-none font-extrabold tracking-tight">404</p>
      <h1 className="mt-4 text-xl font-extrabold text-ink sm:text-2xl">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-mute">The page you're looking for doesn't exist or may have been moved.</p>
      <a href={user ? "#/dashboard" : "#/"} className="mt-6">
        <Button variant="primary" size="lg">
          {user ? "Return to Dashboard" : "Back to home"}
        </Button>
      </a>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    checkBackend()
      .then((data) => {
        console.log("Backend connected:", data);
      })
      .catch((error) => {
        console.error("Backend connection failed:", error);
      });
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <HashRouter>
              <Routes>
                <Route path="/" element={<HomeGate />} />
                <Route path="/auth" element={<Navigate to="/signup" replace />} />
                <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
                <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
                <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
                <Route path="/onboarding" element={<OnboardingGate />} />

                <Route element={<AppGate />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/workspace/select" element={<WorkspaceSelect />} />
                  <Route path="/workspace/configure" element={<WorkspaceConfigure />} />
                  <Route path="/workspace/preview" element={<WorkspacePreview />} />
                  <Route path="/image-generator" element={<ImageGenerator />} />
                  <Route path="/files" element={<Files />} />
                  <Route path="/recents" element={<Recents />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
                  <Route path="/settings/:section" element={<Settings />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/help" element={<Help />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </HashRouter>
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
