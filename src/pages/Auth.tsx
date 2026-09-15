import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LayoutTemplate, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Field, Input } from "../components/ui";
import { OtpInput } from "../components/OtpInput";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { resendOtp, sendOtp, verifyOtp } from "../services/otpService";
import { EraLogo } from "../components/branding/EraLogo";

/* ------------------------------ Brand side panel ---------------------------- */

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#070919] lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Background ambient lighting & technical grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 h-[550px] w-[550px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.35),transparent_65%)] blur-2xl" />
        <div className="absolute -bottom-40 -left-24 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.38),transparent_65%)] blur-2xl" />
        <div className="absolute top-1/3 left-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),transparent_65%)] blur-xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Brand logo header */}
      <div className="relative flex items-center gap-3.5">
        <EraLogo variant="full" size="xl" href="/" />
      </div>

      {/* Main hero copy */}
      <div className="relative my-auto py-10">
        <h1 className="text-4xl leading-[1.12] font-extrabold tracking-tight text-white xl:text-[46px]">
          Transform Content.
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-violet-300 bg-clip-text text-transparent">
            Accelerate Government
          </span>
          <br />
          Work.
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-300/85">
          Transform government documents into clear, professional and actionable content with AI.
        </p>

        {/* Feature cards */}
        <div className="mt-10 grid max-w-lg grid-cols-1 gap-3.5 sm:grid-cols-3">
          {[
            { icon: FileText, label: "13 work types", sub: "Briefs to social posts" },
            { icon: LayoutTemplate, label: "Platform previews", sub: "LinkedIn & X views" },
            { icon: ShieldCheck, label: "Private workspace", sub: "Government-ready" },
          ].map((f) => (
            <div
              key={f.label}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition duration-200 hover:border-white/20 hover:bg-white/[0.07]"
            >
              <f.icon className="h-5 w-5 text-indigo-400 transition group-hover:scale-110" />
              <p className="mt-2.5 text-[13.5px] font-bold text-white">{f.label}</p>
              <p className="mt-0.5 text-[11.5px] text-slate-400">{f.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom trust statement */}
      <div className="relative flex items-center gap-2 text-xs font-medium text-slate-400">
        <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
        <span>Your workspace is private · Built for professional government workflows</span>
      </div>
    </div>
  );
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="app-canvas flex min-h-screen bg-[#050716]">
      <BrandPanel />
      <div className="relative flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-[440px]">
          {/* Mobile brand header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <EraLogo variant="compact" size="md" href="/" />
          </div>

          {/* Main Auth Card */}
          <div className="anim-slide-up rounded-3xl border border-line/80 bg-surface/95 p-7 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-9">
            <h2 className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-mute">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-mute">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function GoogleButton({ onLogin, label = "Continue with Google" }: { onLogin: () => Promise<unknown>; label?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      className="w-full h-11 border-line2 hover:border-brand/40"
      size="lg"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await onLogin();
        } finally {
          setLoading(false);
        }
      }}
    >
      {!loading && <GoogleIcon />}
      {label}
    </Button>
  );
}

/* ----------------------------- Email OTP Flow ------------------------------- */

function EmailOtpFlow({ mode }: { mode: "signup" | "signin" }) {
  const { loginWithOtp, googleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");

  // Resend countdown timer effect
  useEffect(() => {
    if (step !== "otp" || resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const handleSendOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid work email address.");
      return;
    }

    setIsSendingOtp(true);
    const res = await sendOtp(email.trim());
    setIsSendingOtp(false);

    if (!res.ok) {
      setError(res.error || "Couldn't send the code. Please try again.");
      return;
    }

    setStep("otp");
    setOtp("");
    setResendCountdown(60);
    toast.success("Verification code sent", `Check ${email} for your 6-digit code.`);
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setError("");
    setIsSendingOtp(true);
    const res = await resendOtp(email.trim());
    setIsSendingOtp(false);

    if (!res.ok) {
      setError(res.error || "Couldn't send the code. Please try again.");
      return;
    }

    setResendCountdown(60);
    toast.success("Code resent", `A new verification code was sent to ${email}.`);
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    setError("");

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    const res = await verifyOtp(email.trim(), code);

    if (!res.ok) {
      setIsVerifyingOtp(false);
      setError(res.error || "Incorrect code. Please try again.");
      return;
    }

    const authRes = await loginWithOtp(email.trim(), mode);
    setIsVerifyingOtp(false);

    if (!authRes.ok) {
      setError(authRes.error || "Authentication failed. Please try again.");
      return;
    }

    if (authRes.onboardingRequired) {
      toast.success("Email verified", "Welcome to ERA.");
      navigate("/onboarding", { replace: true });
    } else {
      toast.success("Signed in successfully", "Welcome back to ERA.");
      navigate("/dashboard", { replace: true });
    }
  };

  if (step === "otp") {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={
          <span>
            We've sent a 6-digit verification code to{" "}
            <span className="font-semibold text-ink break-all">{email}</span>
          </span>
        }
      >
        <div className="space-y-5">
          <div className="py-2">
            <OtpInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (error) setError("");
              }}
              onComplete={(val) => handleVerifyOtp(val)}
              disabled={isVerifyingOtp}
              error={!!error}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-danger/30 bg-errsoft/40 p-3 text-xs font-medium text-danger">
              {error}
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full shadow-lg"
            loading={isVerifyingOtp}
            onClick={() => handleVerifyOtp()}
          >
            {!isVerifyingOtp && <ArrowRight className="h-4 w-4" />} Verify & Continue
          </Button>

          <div className="flex flex-col items-center gap-3 pt-2 text-xs">
            <div className="text-mute flex items-center gap-1.5">
              <span>Didn't receive the code?</span>
              {resendCountdown > 0 ? (
                <span className="font-medium text-soft">Resend code in {resendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isSendingOtp}
                  className="font-semibold text-brandink hover:underline inline-flex items-center gap-1"
                >
                  {isSendingOtp && <RefreshCw className="h-3 w-3 animate-spin" />}
                  Resend OTP
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError("");
              }}
              className="font-semibold text-soft hover:text-ink transition"
            >
              Change email
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  const isSignup = mode === "signup";

  return (
    <AuthShell
      title={isSignup ? "Create your ERA account" : "Sign in to ERA"}
      subtitle={isSignup ? "Enter your work email to get started." : "Enter your work email to continue."}
      footer={
        isSignup ? (
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brandink hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-brandink hover:underline">
              Create account
            </Link>
          </>
        )
      }
    >
      <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
        <Field label="Work email" error={error}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@organisation.gov.in"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            error={!!error}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full shadow-lg"
          loading={isSendingOtp}
        >
          {!isSendingOtp && <ArrowRight className="h-4 w-4" />} Send OTP
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] font-bold tracking-widest text-soft uppercase">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton
        onLogin={async () => {
          const res = await googleLogin();
          if (res.ok) {
            toast.success("Signed in with Google", "Welcome to ERA.");
            navigate("/dashboard", { replace: true });
          } else if (res.error) {
            toast.error("Google sign in failed", res.error);
          }
        }}
      />
    </AuthShell>
  );
}

/* ----------------------------------- Login ---------------------------------- */

export function LoginPage() {
  return <EmailOtpFlow mode="signin" />;
}

/* ----------------------------------- Signup --------------------------------- */

export function SignupPage() {
  return <EmailOtpFlow mode="signup" />;
}

/* ------------------------------ Forgot password ----------------------------- */

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      const { auth } = await import("../services/firebase");
      await sendPasswordResetEmail(auth, email);
      setLoading(false);
      setSent(true);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Failed to send password reset email.");
    }
  };

  return (
    <AuthShell
      title={sent ? "Reset link sent" : "Reset your password"}
      subtitle={
        sent ? (
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              We sent a password reset link to <span className="font-semibold text-ink">{email}</span>. Check your email for instructions.
            </span>
          </span>
        ) : (
          "Enter your email address and we'll send a password reset link."
        )
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brandink hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-success/25 bg-oksoft p-4 text-sm text-mute">
            The link expires in 30 minutes. If you don't see the email, check your spam folder.
          </div>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setSent(false)}>
            Send another link
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email address" error={error}>
            <Input type="email" placeholder="you@organisation.gov.in" icon={<Mail className="h-4 w-4" />} value={email} error={!!error} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full shadow-lg" loading={loading}>
            {!loading && <Sparkles className="h-4 w-4" />} Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
