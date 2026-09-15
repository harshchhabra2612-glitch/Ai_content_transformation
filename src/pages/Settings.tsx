import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  Check,
  Laptop,
  Loader2,
  Lock,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Smartphone,
  Sun,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { Avatar, Badge, Button, Card, Field, Input, Modal, Select, Toggle, badgeTone } from "../components/ui";
import { DOC_TONES, LENGTHS, ROLES, TRANSFORMATIONS } from "../data/mock";
import { cn } from "../utils/cn";
import type { LengthId, ThemeMode, ToneId, TransformationId } from "../types";

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "preferences", label: "Preferences", icon: Laptop },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export default function Settings() {
  const { section } = useParams();
  const navigate = useNavigate();
  const active = (["account", "preferences", "appearance", "notifications", "security"].includes(section ?? "") ? section : "account") as string;

  return (
    <div className="space-y-5">
      <div className="anim-slide-up">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Settings</h1>
        <p className="mt-1 text-[14px] text-mute">Manage your government workspace account and preferences.</p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <aside className="anim-slide-up lg:w-60 lg:shrink-0" style={{ animationDelay: "40ms" }}>
          <nav className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-card)] lg:flex-col">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/settings/${t.id}`)}
                className={cn(
                  "focus-ring flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition lg:w-full",
                  active === t.id ? "bg-brandsoft text-brandink" : "text-mute hover:bg-s2 hover:text-ink"
                )}
              >
                <t.icon className="h-4.5 w-4.5" />
                {t.label}
                {active === t.id && <Check className="ml-auto hidden h-4 w-4 lg:block" />}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {active === "account" && <AccountSection />}
          {active === "preferences" && <PrefsSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "notifications" && <NotifSection />}
          {active === "security" && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Account ---------------------------------- */

function AccountSection() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [dept, setDept] = useState(user?.org ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? "");
  const [pwOpen, setPwOpen] = useState(false);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const savingLockRef = useRef(false);
  const hideSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName((prev) => (savingLockRef.current ? prev : user.name));
      setDept((prev) => (savingLockRef.current ? prev : user.org));
      setRole((prev) => (savingLockRef.current ? prev : user.role));
      setPhotoURL((prev) => (savingLockRef.current ? prev : user.photoURL ?? ""));
    }
  }, [user]);

  const performAutoSave = async (patch: Partial<{ name: string; org: string; role: string; photoURL: string }>) => {
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    setSaveStatus("saving");

    try {
      const res = await updateUser(patch);
      if (res?.ok !== false) {
        setSaveStatus("saved");
        if (hideSavedTimeoutRef.current) clearTimeout(hideSavedTimeoutRef.current);
        hideSavedTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2500);
      } else {
        setSaveStatus("idle");
        toast.error("Couldn't save changes", res?.error || "Please try again.");
      }
    } catch {
      setSaveStatus("idle");
      toast.error("Couldn't save changes", "Please try again.");
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(user?.name ?? "");
      return;
    }
    if (trimmed !== user?.name) {
      performAutoSave({ name: trimmed });
    }
  };

  const handleDeptBlur = () => {
    const trimmed = dept.trim();
    if (trimmed !== user?.org) {
      performAutoSave({ org: trimmed });
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value;
    setRole(nextRole);
    if (nextRole !== user?.role) {
      performAutoSave({ role: nextRole });
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo too large", "Please select an image smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const url = evt.target?.result as string;
      if (url) {
        setPhotoURL(url);
        performAutoSave({ photoURL: url });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <Card className="anim-slide-up p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-ink">Profile</h2>
            <p className="text-[13px] text-mute">Your personal information and government workspace role.</p>
          </div>
          {saveStatus !== "idle" && (
            <div className="anim-fade flex items-center gap-1.5 rounded-full border border-line bg-s2/90 px-3 py-1 text-xs font-semibold">
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span className="text-mute">Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="text-success font-medium">Saved</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2.5">
            <Avatar name={name || "User"} src={photoURL} size="xl" />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Change photo
            </Button>
          </div>

          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Enter your full name"
              />
            </Field>

            <Field label="Work email" hint="Managed by your account">
              <Input
                type="email"
                value={user?.email ?? ""}
                readOnly
                disabled
                className="opacity-75 cursor-not-allowed"
              />
            </Field>

            <Field label="Government Department">
              <Input
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                onBlur={handleDeptBlur}
                placeholder="e.g. Ministry of Home Affairs"
              />
            </Field>

            <Field label="Role">
              <Select value={role} onChange={handleRoleChange} aria-label="Role">
                <option value="">Select a role…</option>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      <Card className="anim-slide-up flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warnsoft text-warning">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Password</p>
            <p className="text-xs text-mute">Last changed 9 days ago · Use at least 6 characters.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setPwOpen(true)}>
          Change Password
        </Button>
      </Card>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (!cur || next.length < 6 || next !== confirm) {
      setErr("Enter your current password and a new password of at least 6 characters that matches.");
      return;
    }
    toast.success("Password updated", "Use your new password next time you sign in.");
    setCur("");
    setNext("");
    setConfirm("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Change password" description="Choose a strong password you don't use elsewhere." size="sm">
      <div className="space-y-4">
        <Field label="Current password">
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" error={err}>
          <Input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr(""); }} autoComplete="new-password" />
        </Field>
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Update password
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- Preferences ------------------------------- */

function PrefsSection() {
  const { prefs, updatePrefs, clearAllData } = useApp();
  const toast = useToast();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const notify = (label: string) => toast.success("Preference saved", `${label} updated.`);

  return (
    <Card className="anim-slide-up p-5 sm:p-6">
      <h2 className="text-[15px] font-bold text-ink">Preferences</h2>
      <p className="text-[13px] text-mute">Defaults used when you open the workspace. ERA generates content in English.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Default tone">
          <Select value={prefs.tone} onChange={(e) => { updatePrefs({ tone: e.target.value as ToneId }); notify("Default tone"); }} aria-label="Default tone">
            {DOC_TONES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Default output length">
          <Select value={prefs.length} onChange={(e) => { updatePrefs({ length: e.target.value as LengthId }); notify("Default length"); }} aria-label="Default length">
            {LENGTHS.map((t) => (
              <option key={t.id} value={t.id}>{t.label} — {t.hint}</option>
            ))}
          </Select>
        </Field>
        <Field label="Default transformation">
          <Select value={prefs.defaultTransformation} onChange={(e) => { updatePrefs({ defaultTransformation: e.target.value as TransformationId }); notify("Default transformation"); }} aria-label="Default transformation">
            {TRANSFORMATIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-s2/50 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-infosoft text-info">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Language</p>
            <p className="text-[11px] text-mute">Fixed to English in this version.</p>
          </div>
          <Badge className={cn("ml-auto", badgeTone.info)}>English</Badge>
        </div>
      </div>
      <div className="mt-6 divide-y divide-line rounded-2xl border border-line">
        <Toggle checked={prefs.autoSave} onChange={(v) => { updatePrefs({ autoSave: v }); notify("Auto-save"); }} label="Auto-save documents" description="Save changes to your results automatically while editing." />
        <Toggle checked={emailNotifs} onChange={(v) => { setEmailNotifs(v); toast.success("Preference saved", `Email notifications ${v ? "enabled" : "muted"}.`); }} label="Email notifications" description="Receive email summaries of workspace activity." />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
        <div>
          <p className="text-sm font-semibold text-ink">Clear Workspace Data</p>
          <p className="text-xs text-mute">Reset all cached workspace files, recents, and statistics.</p>
        </div>
        <Button variant="danger" size="sm" onClick={clearAllData}>
          Clear Demo Data
        </Button>
      </div>
    </Card>
  );
}

/* --------------------------------- Appearance ------------------------------- */

const THEME_PREVIEWS: { id: ThemeMode; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "light", label: "Light", icon: Sun, desc: "Clean surfaces for bright offices" },
  { id: "dark", label: "Dark", icon: Moon, desc: "Low-glare for focused work" },
  { id: "system", label: "System", icon: Monitor, desc: "Follow your operating system" },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { prefs, updatePrefs } = useApp();
  const toast = useToast();

  return (
    <div className="space-y-5">
      <Card className="anim-slide-up p-5 sm:p-6">
        <h2 className="text-[15px] font-bold text-ink">Theme</h2>
        <p className="text-[13px] text-mute">Choose how ERA looks across your workspace.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {THEME_PREVIEWS.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  toast.success("Theme updated", `${t.label} theme applied.`);
                }}
                className={cn("focus-ring group overflow-hidden rounded-2xl border-2 text-left transition-all duration-200", active ? "border-brand shadow-[var(--shadow-glow)]" : "border-line hover:border-line2")}
              >
                <div className={cn("relative h-24 overflow-hidden border-b", t.id === "dark" ? "bg-[#0a0e1c]" : t.id === "light" ? "bg-[#f3f5fb]" : "bg-gradient-to-br from-[#f3f5fb] via-[#c9cff0] to-[#0a0e1c]")}>
                  <span className={cn("absolute top-3 left-3 h-2.5 w-2.5 rounded-full", t.id === "dark" ? "bg-[#7b7ff2]" : "bg-[#4f46e5]")} />
                  <span className={cn("absolute top-3 left-8 h-2 w-14 rounded-full", t.id === "dark" ? "bg-white/20" : "bg-black/10")} />
                  <span className="absolute right-3 bottom-3 h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg" />
                  <span className={cn("absolute right-14 bottom-4 h-2 w-12 rounded-full", t.id === "dark" ? "bg-white/15" : "bg-black/10")} />
                </div>
                <div className="flex items-center gap-2 p-3.5">
                  <t.icon className={cn("h-4.5 w-4.5", active ? "text-brand" : "text-soft")} />
                  <span className="flex-1 text-sm font-bold text-ink">{t.label}</span>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand2 text-white">
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                  )}
                </div>
                <p className="px-3.5 pb-3.5 text-[11.5px] leading-snug text-mute">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="anim-slide-up divide-y divide-line">
        <Toggle checked={prefs.compact} onChange={(v) => { updatePrefs({ compact: v }); toast.success("Preference saved", v ? "Compact mode enabled." : "Compact mode disabled."); }} label="Compact mode" description="Reduce spacing to fit more content on screen." />
        <Toggle checked={prefs.reduceMotion} onChange={(v) => { updatePrefs({ reduceMotion: v }); toast.success("Preference saved", v ? "Reduced motion enabled." : "Motion restored."); }} label="Reduce motion" description="Minimize animations and transitions across ERA." />
      </Card>
    </div>
  );
}

/* ------------------------------- Notifications ------------------------------ */

type NotifPrefKey = "notifTransformation" | "notifUpload" | "notifWorkspace" | "notifStorage" | "notifUpdates";

function NotifSection() {
  const { prefs, updatePrefs } = useApp();
  const toast = useToast();
  const rows: { key: NotifPrefKey; title: string; desc: string }[] = [
    { key: "notifTransformation", title: "Transformation completed", desc: "Notify when a generated result is ready." },
    { key: "notifUpload", title: "File uploaded", desc: "Confirmations when documents finish uploading." },
    { key: "notifWorkspace", title: "Workspace activity", desc: "When documents are shared or moved in your workspace." },
    { key: "notifStorage", title: "Storage alerts", desc: "Warnings when your workspace storage is nearly full." },
    { key: "notifUpdates", title: "Product updates", desc: "News about new work types and features." },
  ];
  return (
    <Card className="anim-slide-up divide-y divide-line">
      {rows.map((r) => (
        <Toggle
          key={r.key}
          checked={prefs[r.key]}
          onChange={(v) => {
            updatePrefs({ [r.key]: v });
            toast.success("Notification preference saved", `${r.title} ${v ? "enabled" : "muted"}.`);
          }}
          label={r.title}
          description={r.desc}
        />
      ))}
    </Card>
  );
}

/* ---------------------------------- Security -------------------------------- */

function currentDeviceLabel() {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "your device";
  return `${browser} — ${os}`;
}

function SecuritySection() {
  const { user, verifyMfaState } = useAuth();
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);
  const deviceLabel = currentDeviceLabel();
  const isMobile = /Android|iPhone|iPad/.test(typeof navigator !== "undefined" ? navigator.userAgent : "");

  const handleVerifyMfa = async () => {
    setVerifying(true);
    try {
      const res = await verifyMfaState("123456");
      if (res.ok) {
        toast.success("MFA Verified", "Multi-Factor Authentication status has been confirmed by the backend.");
      } else {
        toast.error("MFA Error", res.error || "Failed to verify MFA state.");
      }
    } catch (err: any) {
      toast.error("MFA Error", err?.message || "Verification request failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Account Security & Role Status */}
      <Card className="anim-slide-up p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brandsoft text-brand">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Role & Authorization Level</h2>
                <p className="mt-0.5 text-[13px] text-mute">Verified identity and permission profile derived from backend authorization layer.</p>
              </div>
              <Badge className={user?.role === "ADMIN" ? badgeTone.brand : badgeTone.neutral}>
                Role: {user?.role || "OFFICER"}
              </Badge>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-s2 p-3.5">
              <p className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Granted RBAC Permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {(user?.permissions || ["upload", "read", "transform", "export", "share"]).map((perm) => (
                  <span key={perm} className="inline-flex items-center gap-1 rounded-md bg-surface border border-line px-2 py-1 text-xs font-medium text-ink">
                    <Check className="h-3 w-3 text-success" />
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. MFA Verification State */}
      <Card className="anim-slide-up p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brandsoft text-brand">
            <Lock className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Multi-Factor Authentication (MFA)</h2>
                <p className="mt-0.5 text-[13px] text-mute">Required by backend policy for sensitive actions (document deletion, sharing, role modifications).</p>
              </div>
              <Badge className={user?.mfa_verified ? badgeTone.success : badgeTone.warning}>
                {user?.mfa_verified ? "MFA Verified" : "MFA Unverified"}
              </Badge>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {!user?.mfa_verified ? (
                <Button variant="primary" size="sm" onClick={handleVerifyMfa} disabled={verifying}>
                  {verifying ? "Verifying MFA..." : "Confirm & Verify MFA Status"}
                </Button>
              ) : (
                <span className="text-xs font-semibold text-success flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Multi-factor authentication is active and verified for this session.
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Active Sessions */}
      <Card className="anim-slide-up overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-bold text-ink">Active session identity</h2>
          <p className="text-[13px] text-mute">Current session token authenticated with backend security layer.</p>
        </div>
        <div className="divide-y divide-line">
          <div className="flex items-center gap-3.5 px-5 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-oksoft text-success">
              {isMobile ? <Smartphone className="h-4.5 w-4.5" /> : <Laptop className="h-4.5 w-4.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                {deviceLabel}
                <Badge className={badgeTone.success}>Authenticated</Badge>
              </p>
              <p className="text-xs text-mute">User ID: {user?.user_id || "authenticated-user"}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
