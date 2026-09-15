import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { Avatar, IconButton, Menu } from "../ui";
import { EraLogo } from "../branding/EraLogo";
import type { ThemeMode, TransformationId } from "../../types";
import { TRANSFORMATIONS } from "../../data/mock";

/* --------------------------------- Nav data -------------------------------- */

const MAIN_NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workspace", label: "Workspace", icon: Sparkles },
  { to: "/image-generator", label: "Image Generator", icon: ImageIcon },
  { to: "/files", label: "Files", icon: FolderOpen },
  { to: "/recents", label: "Recents", icon: History },
  { to: "/insights", label: "Insights", icon: BarChart3 },
];

const BOTTOM_NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: CircleHelp },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/workspace": "Workspace",
  "/workspace/select": "Workspace · Choose Work",
  "/workspace/configure": "Workspace · Configure",
  "/workspace/preview": "Workspace · Preview",
  "/image-generator": "AI Image Generator",
  "/files": "Files",
  "/recents": "Recents",
  "/insights": "Insights",
  "/settings": "Settings",
  "/admin": "Security & Administration",
  "/help": "Help",
};

/* ------------------------------- Sidebar item ------------------------------- */

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const mainNav = useMemo(() => {
    if (user?.role?.toUpperCase() === "ADMIN") {
      return [...MAIN_NAV, { to: "/admin", label: "Admin Security", icon: ShieldCheck }];
    }
    return MAIN_NAV;
  }, [user?.role]);

  const render = (items: { to: string; label: string; icon: LucideIcon }[]) =>
    items.map((it) => (
      <NavLink
        key={it.to}
        to={it.to}
        onClick={onNavigate}
        title={it.label}
        className={({ isActive }) =>
          cn(
            "group focus-ring relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-150",
            isActive ? "text-brandink" : "text-mute hover:bg-s2 hover:text-ink",
            "lg:px-3.5"
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand to-brand2" aria-hidden />}
            <it.icon className={cn("h-[19px] w-[19px] shrink-0 transition-colors", isActive ? "text-brand" : "text-soft group-hover:text-mute")} strokeWidth={isActive ? 2.4 : 2} />
            <span className="hidden flex-1 lg:block">{it.label}</span>
            {isActive && (
              <span className="hidden rounded-md bg-brandsoft px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider lg:inline-block">Active</span>
            )}
          </>
        )}
      </NavLink>
    ));

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4" aria-label="Primary">
      <p className="mb-2 hidden px-3 text-[10px] font-bold tracking-[0.14em] text-soft uppercase lg:block">Workspace</p>
      {render(mainNav)}
      <div className="my-3 hidden h-px bg-line lg:block" />
      {render(BOTTOM_NAV)}
    </nav>
  );
}

/* ------------------------------ Command palette ----------------------------- */

interface PalItem {
  label: string;
  group: string;
  icon: LucideIcon;
  hint?: string;
  run: () => void;
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { library, openInWorkspace, setSelectedTransformation, sessionFiles } = useApp();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<PalItem[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: PalItem[] = [
      { label: "Dashboard", group: "Pages", icon: LayoutDashboard, hint: "Go to", run: () => navigate("/dashboard") },
      { label: "Workspace", group: "Pages", icon: Sparkles, hint: "Go to", run: () => navigate("/workspace") },
      { label: "Files", group: "Pages", icon: FolderOpen, hint: "Go to", run: () => navigate("/files") },
      { label: "Recents", group: "Pages", icon: History, hint: "Go to", run: () => navigate("/recents") },
      { label: "Insights", group: "Pages", icon: BarChart3, hint: "Go to", run: () => navigate("/insights") },
      { label: "Settings", group: "Pages", icon: Settings, hint: "Go to", run: () => navigate("/settings") },
      { label: "Help & Support", group: "Pages", icon: CircleHelp, hint: "Go to", run: () => navigate("/help") },
    ];
    const trans: PalItem[] = TRANSFORMATIONS.slice(0, 6).map((t) => ({
      label: t.label,
      group: "Transformations",
      icon: Sparkles,
      run: () => {
        setSelectedTransformation(t.id as TransformationId);
        if (sessionFiles.length > 0) navigate("/workspace");
        else navigate("/dashboard");
      },
    }));
    const files: PalItem[] = library.slice(0, 7).map((f) => ({
      label: f.name,
      group: "Files",
      icon: f.kind === "xlsx" ? FileSpreadsheet : FileText,
      hint: "Open in workspace",
      run: () => {
        openInWorkspace(f);
        navigate("/workspace");
      },
    }));
    const actions: PalItem[] = [
      { label: "Upload a document", group: "Actions", icon: Search, hint: "Dashboard", run: () => navigate("/dashboard") },
      { label: "Switch to dark theme", group: "Actions", icon: Moon, run: () => setTheme("dark") },
      { label: "Switch to light theme", group: "Actions", icon: Sun, run: () => setTheme("light") },
    ];
    const all = [...pages, ...trans, ...files, ...actions];
    if (!q) return all.slice(0, 14);
    return all.filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)).slice(0, 12);
  }, [query, library, navigate, openInWorkspace, sessionFiles.length, setSelectedTransformation, setTheme]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
      if (e.key === "Enter" && items[active]) {
        items[active].run();
        onClose();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, items, active, onClose]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="anim-fade absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-scale-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4.5 w-4.5 shrink-0 text-soft" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, pages, transformations…"
            aria-label="Search"
            className="h-13 w-full bg-transparent text-[15px] text-ink placeholder:text-soft focus:outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-line bg-s2 px-1.5 py-0.5 text-[10px] font-semibold text-soft">ESC</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-mute">
              No results for “{query}”. Try another search.
            </p>
          )}
          {items.map((it, i) => {
            const showGroup = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <div key={`${it.group}-${it.label}`}>
                {showGroup && <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-soft uppercase">{it.group}</p>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    it.run();
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active === i ? "bg-brandsoft text-brandink" : "text-ink"
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active === i ? "bg-white/60" : "bg-s2")}>
                    <it.icon className="h-4 w-4 text-mute" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-[11px] text-soft">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-s2/50 px-4 py-2.5 text-[11px] text-soft">
          <span><kbd className="mr-1 rounded bg-s3 px-1">↑↓</kbd> navigate</span>
          <span><kbd className="mr-1 rounded bg-s3 px-1">↵</kbd> open</span>
          <span className="ml-auto">Press Ctrl K anytime</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Theme control ------------------------------ */

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const opts: { id: ThemeMode; label: string; icon: LucideIcon }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];
  return (
    <Menu
      align="right"
      width="w-44"
      trigger={
        <IconButton label="Change theme">
          {theme === "light" ? <Sun className="h-[18px] w-[18px]" /> : theme === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Monitor className="h-[18px] w-[18px]" />}
        </IconButton>
      }
      items={opts.map((o) => ({
        label: o.label,
        icon: o.icon,
        onClick: () => {
          setTheme(o.id);
          toast.success("Theme updated", `${o.label} theme applied.`);
        },
        ...(theme === o.id ? { shortcut: "✓" } : {}),
      }))}
    />
  );
}

/* ----------------------------- Notifications panel -------------------------- */

function NotificationsPanel() {
  const { notifications, markAllRead, clearNotifications, toggleNotification } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const icon = (kind: string) =>
    kind === "success" ? <Check className="h-3.5 w-3.5 text-success" /> : kind === "warning" ? (
      <span className="text-warning">!</span>
    ) : (
      <span className="text-info">i</span>
    );

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-[10px] text-mute transition hover:bg-s3 hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
          </span>
        )}
      </button>
      {open && (
        <div className="anim-scale-in absolute right-0 z-50 mt-2 w-[min(92vw,380px)] origin-top-right overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-[var(--shadow-pop)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">Notifications</p>
            <div className="flex items-center gap-1">
              <button onClick={markAllRead} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brandink transition hover:bg-brandsoft">
                Mark all read
              </button>
              <IconButton label="Clear notifications" size="sm" onClick={clearNotifications}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-soft" />
                <p className="text-sm font-semibold text-ink">All caught up</p>
                <p className="text-xs text-mute">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => toggleNotification(n.id)}
                  className={cn("flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-s2", !n.read && "bg-brandsoft/40")}
                >
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", n.kind === "success" ? "bg-oksoft" : n.kind === "warning" ? "bg-warnsoft" : "bg-infosoft")}>
                    {icon(n.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{n.title}</span>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-mute">{n.body}</span>
                    <span className="mt-1 block text-[10.5px] font-medium text-soft">{n.time}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Profile menu ------------------------------ */

function ProfileMenu() {
  const { user, logout } = useAuth();
  const { clearSession } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const go = (to: string) => {
    navigate(to);
    setOpen(false);
  };

  const signOut = () => {
    setOpen(false);
    logout();
    clearSession();
    toast.info("Signed out", "You have been signed out of ERA.");
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" className="focus-ring rounded-full transition hover:opacity-85">
        <Avatar name={user?.name || "User"} src={user?.photoURL} size="md" />
      </button>
      {open && (
        <div className="anim-scale-in absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-[var(--shadow-pop)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <Avatar name={user?.name || "User"} src={user?.photoURL} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{user?.name || "User"}</p>
              <p className="truncate text-xs text-mute">{user?.email}</p>
            </div>
          </div>
          <div className="p-1.5">
            {[
              { label: "Account settings", icon: Settings, to: "/settings/account" },
              { label: "Preferences", icon: Sparkles, to: "/settings/preferences" },
              { label: "Appearance", icon: Sun, to: "/settings/appearance" },
            ].map((it) => (
              <button key={it.label} onClick={() => go(it.to)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-s2">
                <it.icon className="h-4 w-4 text-soft" /> {it.label}
              </button>
            ))}
            <div className="my-1.5 h-px bg-line" />
            <button onClick={() => go("/help")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-s2">
              <CircleHelp className="h-4 w-4 text-soft" /> Help & Support
            </button>
            <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-danger transition hover:bg-errsoft">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
          <div className="border-t border-line bg-s2/50 px-4 py-2.5 text-[10.5px] font-medium text-soft">
            Enterprise-ready workspace · Your workspace is private.
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Mobile drawer ------------------------------- */

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { clearSession } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const close = (fn?: () => void) => () => {
    onClose();
    fn?.();
  };

  return (
    <>
      <div className={cn("fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm transition-opacity md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} aria-hidden />
      <aside
        className={cn(
          "glass-strong fixed inset-y-0 left-0 z-[70] flex w-[280px] flex-col transition-transform duration-300 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <EraLogo variant="compact" size="md" href="/dashboard" />
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-mute hover:bg-s3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavItems onNavigate={onClose} />
        <div className="border-t border-line p-3">
          <button onClick={close(() => navigate("/settings/account"))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-s2">
            <Avatar name={user?.name || "User"} src={user?.photoURL} size="sm" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-bold text-ink">{user?.name || "User"}</span>
              <span className="block truncate text-[11px] text-mute">{user?.org || user?.email}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-soft" />
          </button>
          <button
            onClick={close(() => {
              logout();
              clearSession();
              toast.info("Signed out", "You have been signed out of ERA.");
            })}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-danger transition hover:bg-errsoft"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

/* ---------------------------------- AppShell -------------------------------- */

export default function AppShell() {
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const navigate = useNavigate();
  const { prefs } = useApp();
  const { user } = useAuth();

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const crumbs = TITLES[location.pathname] ? TITLES[location.pathname] : location.pathname.startsWith("/settings") ? "Settings" : "ERA";
  const compact = prefs.compact;

  return (
    <div className="app-canvas min-h-screen">
      {/* Desktop / tablet sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[78px] flex-col border-r border-line md:flex lg:w-[256px]">
        <div className="flex h-16 items-center justify-center border-b border-line px-3 lg:justify-start lg:px-5">
          <EraLogo variant="compact" size="md" href="/dashboard" className="hidden lg:inline-flex" />
          <EraLogo variant="mark" size="sm" href="/dashboard" className="lg:hidden" />
        </div>
        <NavItems />
        <div className="border-t border-line p-3">
          <button
            onClick={() => navigate("/settings/account")}
            title="Your profile"
            className="flex w-full items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-s2 lg:px-2.5"
          >
            <Avatar name={user?.name || "User"} src={user?.photoURL} size="md" />
            <span className="hidden min-w-0 flex-1 text-left lg:block">
              <span className="block truncate text-[13px] font-bold text-ink">{user?.name || "User"}</span>
              <span className="block truncate text-[11px] text-mute">Manage account</span>
            </span>
            <ChevronRight className="hidden h-4 w-4 text-soft lg:block" />
          </button>
        </div>
      </aside>

      <MobileDrawer open={mobileNav} onClose={() => setMobileNav(false)} />

      {/* Main column */}
      <div className="flex min-h-screen flex-col md:pl-[78px] lg:pl-[256px]">
        <header className="glass-strong sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line px-4 sm:px-6">
          <button onClick={() => setMobileNav(true)} aria-label="Open navigation menu" className="rounded-lg p-2 text-mute transition hover:bg-s3 hover:text-ink md:hidden">
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <EraLogo variant="mark" size="xs" href="/dashboard" />
            <ChevronRight className="hidden h-3.5 w-3.5 text-soft sm:block" />
            <span className="truncate font-bold text-ink">{crumbs}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setPalette(true)}
              className="focus-ring hidden h-9 items-center gap-2 rounded-[10px] border border-line bg-s2/60 px-3 text-[13px] text-soft transition hover:border-line2 hover:text-mute sm:flex"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
              <span>Search…</span>
              <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
            </button>
            <IconButton label="Search" className="sm:hidden" onClick={() => setPalette(true)}>
              <Search className="h-[18px] w-[18px]" />
            </IconButton>
            <ThemeMenu />
            <NotificationsPanel />
            <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
            <ProfileMenu />
          </div>
        </header>

        <main className={cn("mx-auto w-full max-w-[1400px] flex-1", compact ? "px-4 py-4 sm:px-5" : "px-4 py-6 sm:px-6 sm:py-7")}>
          <Outlet />
        </main>
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 text-[11px] text-soft border-t border-line/40">
          <EraLogo variant="full" size="xs" href="/dashboard" />
          <p>Transform Content. Accelerate Work. · Your workspace is private.</p>
        </footer>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
