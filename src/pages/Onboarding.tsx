import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, Landmark, Lock, Sparkles } from "lucide-react";
import { Button } from "../components/ui";
import { DEPARTMENT_SUGGESTIONS, ROLES, SECTORS } from "../data/mock";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../utils/cn";
import { Landmark as LandmarkIcon, Briefcase, Network, GraduationCap, User } from "lucide-react";
import { EraLogo } from "../components/branding/EraLogo";

const SECTOR_ICONS: Record<string, typeof Landmark> = {
  government: LandmarkIcon,
  private: Briefcase,
  enterprise: Network,
  education: GraduationCap,
  personal: User,
};

export default function OnboardingPage() {
  const { completeOnboarding } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<string | null>(null);

  const done = department.trim().length >= 3 && !!role;

  const finish = () => {
    if (!role || !done) return;
    completeOnboarding("government", role, department.trim());
    toast.success("Workspace ready", `Welcome to your Government workspace · ${department.trim()}`);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="app-canvas relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.16),transparent_65%)]" />
        <div className="absolute bottom-0 -left-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.18),transparent_65%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <EraLogo variant="compact" size="md" />
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-mute sm:flex">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Government workspace setup
          </span>
        </div>

        <div className="anim-slide-up rounded-3xl border border-line bg-surface/90 p-6 shadow-[var(--shadow-pop)] backdrop-blur-xl sm:p-9">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Welcome to ERA</h1>
          <p className="mt-1.5 text-[15px] text-mute">Set up your government workspace to start transforming documents.</p>

          {/* Sector */}
          <section className="mt-7">
            <h2 className="text-sm font-bold text-ink">Workspace sector</h2>
            <p className="text-[13px] text-mute">ERA currently supports government workspaces.</p>
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SECTORS.map((w) => {
                const Icon = SECTOR_ICONS[w.icon] ?? LandmarkIcon;
                return (
                  <div
                    key={w.id}
                    aria-disabled={!w.available}
                    className={cn(
                      "relative rounded-2xl border p-4 text-left transition-all duration-200",
                      w.available
                        ? "border-brand bg-brandsoft/70 shadow-[0_6px_20px_-8px_rgba(79,70,229,0.5)]"
                        : "cursor-not-allowed border-line bg-s2/40 opacity-60"
                    )}
                  >
                    {w.available && (
                      <span className="anim-pop absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand2 text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", w.available ? "bg-gradient-to-br from-brand to-brand2 text-white" : "bg-surface text-soft ring-1 ring-line")}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{w.label}</p>
                        <span
                          className={cn(
                            "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            w.available ? "bg-oksoft text-success" : "bg-s3 text-mute"
                          )}
                        >
                          {w.available ? (
                            <>
                              <BadgeCheck className="h-3 w-3" /> Available
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Coming Soon
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-mute">{w.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Department */}
          <section className="mt-8">
            <h2 className="text-sm font-bold text-ink">Department / Organization</h2>
            <p className="text-[13px] text-mute">Enter the department you work for.</p>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Ministry of Home Affairs"
              aria-label="Government department or organization"
              className="focus-ring mt-3 h-12 w-full rounded-xl border border-line bg-s2/70 px-4 text-[15px] text-ink placeholder:text-soft transition-colors hover:border-line2 focus:border-brand"
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DEPARTMENT_SUGGESTIONS.slice(0, 6).map((d) => (
                <button
                  key={d}
                  onClick={() => setDepartment(d)}
                  className={cn(
                    "focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    department === d ? "border-brand bg-brandsoft text-brandink" : "border-line bg-surface text-mute hover:border-line2 hover:text-ink"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </section>

          {/* Role */}
          <section className="mt-8">
            <h2 className="text-sm font-bold text-ink">Your role</h2>
            <p className="text-[13px] text-mute">Choose the role that best describes how you work.</p>
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLES.map((r) => {
                const active = role === r.label;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.label)}
                    aria-pressed={active}
                    className={cn(
                      "focus-ring relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200",
                      active ? "border-brand bg-brandsoft/70 shadow-[0_6px_20px_-8px_rgba(79,70,229,0.5)]" : "border-line bg-s2/40 hover:border-line2 hover:bg-s2"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold text-ink">
                        {r.label}
                        {r.label === "Government Officer" && <Landmark className="h-3.5 w-3.5 text-brand" />}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-mute">{r.description}</span>
                    </span>
                    {active && (
                      <span className="anim-pop flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand2 text-white">
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-9 flex flex-col items-stretch gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-mute">
              Other sectors such as Private Sector and Enterprise are marked <span className="font-semibold text-ink">Coming Soon</span>.
            </p>
            <Button variant="primary" size="lg" className="sm:min-w-60" disabled={!done} onClick={finish}>
              Continue to ERA <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
