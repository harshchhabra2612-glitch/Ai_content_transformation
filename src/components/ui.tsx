import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Folder,
  GraduationCap,
  HelpCircle,
  Landmark,
  ListChecks,
  Loader2,
  Mail,
  Network,
  Presentation,
  RefreshCw,
  ScrollText,
  Target,
  User as UserIcon,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { FileKind, TransformationId } from "../types";

/* --------------------------------- Helpers ---------------------------------- */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return matches;
}

export function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener("mousedown", fn);
    document.addEventListener("touchstart", fn);
    return () => {
      document.removeEventListener("mousedown", fn);
      document.removeEventListener("touchstart", fn);
    };
  }, [ref, handler]);
}

/* ---------------------------------- Button ---------------------------------- */

type BtnVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "soft";
type BtnSize = "xs" | "sm" | "md" | "lg";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
}

const btnVariants: Record<BtnVariant, string> = {
  primary:
    "btn-gradient text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.6)] hover:brightness-110 active:brightness-95 disabled:opacity-45 disabled:shadow-none",
  secondary: "bg-surface text-ink border border-line hover:bg-s3 hover:border-line2 shadow-[var(--shadow-card)]",
  ghost: "text-mute hover:text-ink hover:bg-s3",
  outline: "border border-line2 bg-transparent text-ink hover:bg-s3",
  danger: "bg-errsoft text-danger border border-danger/20 hover:brightness-95",
  soft: "bg-brandsoft text-brandink hover:brightness-95",
};

const btnSizes: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-8.5 px-3.5 text-[13px] gap-2 rounded-[10px]",
  md: "h-10 px-4.5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex cursor-pointer items-center justify-center font-semibold transition-all duration-150 select-none disabled:cursor-not-allowed",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-10 w-10 rounded-xl" : "h-9 w-9 rounded-[10px]";
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring inline-flex cursor-pointer items-center justify-center text-mute transition-all hover:bg-s3 hover:text-ink active:scale-95",
        s,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- Cards ----------------------------------- */

export function Card({ className, children, onClick, style }: { className?: string; children: ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn("rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", className)}
    >
      {children}
    </div>
  );
}

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-2xl shadow-[var(--shadow-card)]", className)}>{children}</div>;
}

/* ---------------------------------- Inputs ---------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-soft">{hint}</span>
      ) : null}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: boolean;
  rightSlot?: ReactNode;
}

export function Input({ icon, error, rightSlot, className, ...rest }: InputProps) {
  return (
    <div className={cn("relative", className)}>
      {icon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soft">{icon}</span>}
      <input
        className={cn(
          "focus-ring h-11 w-full rounded-xl border bg-s2/70 text-[15px] text-ink placeholder:text-soft transition-colors",
          icon ? "pl-10.5" : "pl-3.5",
          rightSlot ? "pr-11" : "pr-3.5",
          error ? "border-danger/60 focus:border-danger" : "border-line hover:border-line2 focus:border-brand",
          "focus:bg-surface"
        )}
        {...rest}
      />
      {rightSlot && <span className="absolute top-1/2 right-2 -translate-y-1/2">{rightSlot}</span>}
    </div>
  );
}

export function PasswordInput({ icon, error, className, ...rest }: InputProps) {
  const [show, setShow] = useState(false);
  return (
    <Input
      type={show ? "text" : "password"}
      icon={icon}
      error={error}
      rightSlot={
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => !s)}
          className="rounded-lg p-1.5 text-soft transition hover:bg-s3 hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
      className={className}
      {...rest}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring w-full rounded-xl border border-line bg-s2/70 p-3.5 text-[14.5px] leading-relaxed text-ink placeholder:text-soft transition-colors hover:border-line2 focus:border-brand focus:bg-surface",
        className
      )}
      {...rest}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      {label && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] font-medium text-mute">{label}</span>
      )}
      <select
        className={cn(
          "focus-ring h-10.5 w-full cursor-pointer appearance-none rounded-[10px] border border-line bg-s2/70 pr-9 text-sm font-medium text-ink transition-colors hover:border-line2 focus:border-brand",
          label ? "pl-3.5" : "pl-3.5"
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-soft" />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-s2"
    >
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-mute">{description}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-10.5 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand" : "bg-line2"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-4.5"
          )}
        />
      </span>
    </button>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring group flex items-start gap-2.5 text-left"
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          checked ? "border-brand bg-brand text-white" : "border-line2 bg-surface group-hover:border-brand"
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="text-sm text-mute group-hover:text-ink">{children}</span>
    </button>
  );
}

/* ---------------------------------- Badges ---------------------------------- */

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

export const badgeTone = {
  success: "bg-oksoft text-success",
  warning: "bg-warnsoft text-warning",
  danger: "bg-errsoft text-danger",
  info: "bg-infosoft text-info",
  neutral: "bg-s3 text-mute",
  brand: "bg-brandsoft text-brandink",
};

/* ---------------------------------- Avatar ---------------------------------- */

export function Avatar({ name, size = "md", src, className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; src?: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const s = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : size === "xl" ? "h-16 w-16 text-lg" : "h-8.5 w-8.5 text-xs";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("inline-block shrink-0 rounded-full object-cover shadow-sm", s, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand2 font-bold text-white shadow-sm",
        s,
        className
      )}
      aria-hidden
    >
      {initials || "U"}
    </span>
  );
}

/* --------------------------------- Progress --------------------------------- */

export function ProgressBar({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "success" | "warning" }) {
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "btn-gradient";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-s3", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-300 ease-out", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} aria-label="Loading" />;
}

/* --------------------------------- Skeletons -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} aria-hidden />;
}

export function usePageReady(delay = 600) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready;
}

export function PageSkeleton({ variant = "grid" }: { variant?: "grid" | "workspace" | "table" }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading page">
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      {variant === "workspace" ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[560px] w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
          <div className={variant === "table" ? "space-y-2" : "grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className={variant === "table" ? "h-16 w-full rounded-xl" : "h-44 w-full rounded-2xl"} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------- Empty / State ------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-s2 text-brand shadow-[var(--shadow-card)]">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-mute">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Modal ----------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={cn("anim-scale-in relative w-full rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]", width)}>
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-bold text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-mute">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Close dialog" className="focus-ring rounded-lg p-1.5 text-soft transition hover:bg-s3 hover:text-ink">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm leading-relaxed text-mute">{message}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------- Menu ------------------------------------ */

export interface MenuItemDef {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
  sep?: boolean;
}

export function Menu({
  trigger,
  items,
  align = "right",
  width = "w-52",
}: {
  trigger: ReactNode;
  items: MenuItemDef[];
  align?: "left" | "right";
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useOnClickOutside(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={cn(
            "anim-scale-in absolute z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface/95 py-1.5 shadow-[var(--shadow-pop)] backdrop-blur-xl",
            align === "right" ? "right-0" : "left-0",
            width
          )}
        >
          {items.map((it, i) =>
            it.sep ? (
              <div key={i} className="my-1.5 h-px bg-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  it.danger ? "text-danger hover:bg-errsoft" : "text-ink hover:bg-s2"
                )}
              >
                {it.icon && <it.icon className="h-4 w-4 shrink-0 text-soft" aria-hidden />}
                <span className="flex-1">{it.label}</span>
                {it.shortcut && <kbd className="rounded bg-s3 px-1.5 py-0.5 font-sans text-[10px] text-soft">{it.shortcut}</kbd>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- File glyphs ------------------------------- */

export const FILE_META: Record<FileKind, { label: string; color: string; soft: string }> = {
  pdf: { label: "PDF", color: "text-[#e0454c]", soft: "bg-[#fdecec]" },
  docx: { label: "DOCX", color: "text-[#2b5fe0]", soft: "bg-[#e9f0fe]" },
  xlsx: { label: "XLSX", color: "text-[#1f9d55]", soft: "bg-[#e6f6ee]" },
  pptx: { label: "PPTX", color: "text-[#e08a2b]", soft: "bg-[#fdf3e3]" },
  txt: { label: "TXT", color: "text-[#64748b]", soft: "bg-[#eef1f6]" },
};

const KIND_ICONS: Record<FileKind, LucideIcon> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  pptx: Presentation,
  txt: FileText,
};

export function FileGlyph({ kind, folder, className }: { kind: FileKind | "folder"; folder?: boolean; className?: string }) {
  if (folder || kind === "folder") {
    return (
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brandsoft text-brand", className)}>
        <Folder className="h-5 w-5" />
      </span>
    );
  }
  const meta = FILE_META[kind];
  const Icon = KIND_ICONS[kind];
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.soft, meta.color, className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/* ------------------------------ Brand glyphs -------------------------------- */

export type IconType = ComponentType<{ className?: string }>;

export function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

/* ---------------------------- Transformation meta --------------------------- */

export interface TransMeta {
  id: TransformationId;
  label: string;
  short: string;
  icon: IconType;
  gradient: string;
  description: string;
}

const ICON_MAP: Record<TransformationId, IconType> = {
  summarize: ScrollText,
  "executive-brief": Briefcase,
  "government-report": BarChart3,
  presentation: Presentation,
  "meeting-notes": ClipboardList,
  "action-items": ListChecks,
  email: Mail,
  faq: HelpCircle,
  rewrite: RefreshCw,
  extract: Target,
  linkedin: LinkedInMark,
  "linkedin-story": LinkedInMark,
  twitter: XMark,
  "photo-generation": Camera,
  "video-generation": Video,
};

const GRADIENT_MAP: Record<TransformationId, string> = {
  summarize: "from-sky-500 to-blue-600",
  "executive-brief": "from-indigo-500 to-violet-600",
  "government-report": "from-emerald-500 to-teal-600",
  presentation: "from-amber-500 to-orange-600",
  "meeting-notes": "from-cyan-500 to-sky-600",
  "action-items": "from-violet-500 to-purple-600",
  email: "from-blue-500 to-indigo-600",
  faq: "from-fuchsia-500 to-pink-600",
  rewrite: "from-rose-500 to-red-600",
  extract: "from-slate-500 to-slate-700",
  linkedin: "from-[#0a66c2] to-[#0e8fe0]",
  "linkedin-story": "from-[#5b3df5] to-[#0a66c2]",
  twitter: "from-slate-900 to-black",
  "photo-generation": "from-pink-500 via-rose-500 to-purple-600",
  "video-generation": "from-purple-600 via-indigo-600 to-blue-600",
};

const LABEL_MAP: Record<TransformationId, string> = {
  summarize: "Summarize",
  "executive-brief": "Executive Brief",
  "government-report": "Government Report",
  presentation: "Presentation",
  "meeting-notes": "Meeting Notes",
  "action-items": "Action Items",
  email: "Email",
  faq: "FAQ",
  rewrite: "Rewrite",
  extract: "Extract Key Points",
  linkedin: "LinkedIn Post",
  "linkedin-story": "LinkedIn Story",
  twitter: "Twitter/X Post",
  "photo-generation": "Photo Generation",
  "video-generation": "Video Generation",
};

export const TRANS_META: Record<TransformationId, TransMeta> = Object.fromEntries(
  (Object.keys(ICON_MAP) as TransformationId[]).map((id) => [
    id,
    {
      id,
      label: LABEL_MAP[id],
      short: LABEL_MAP[id],
      icon: ICON_MAP[id],
      gradient: GRADIENT_MAP[id],
      description: "",
    },
  ])
) as Record<TransformationId, TransMeta>;

export function TransformationGlyph({ id, className }: { id: TransformationId; className?: string }) {
  const meta = TRANS_META[id];
  const Icon = meta.icon;
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", meta.gradient, className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/* ------------------------------ Workspace icons ----------------------------- */

export const WORKSPACE_ICONS: Record<string, IconType> = {
  landmark: Landmark,
  building: Briefcase,
  network: Network,
  graduation: GraduationCap,
  user: UserIcon,
};

export const BRAND_ICONS = { Zap, CloudUpload };
