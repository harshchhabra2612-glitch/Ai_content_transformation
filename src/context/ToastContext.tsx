import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import type { ToastItem } from "../types";
import { cn } from "../utils/cn";

interface ToastCtx {
  toast: (kind: ToastItem["kind"], title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const META = {
  success: { icon: CheckCircle2, ring: "text-success", bar: "bg-success" },
  error: { icon: AlertCircle, ring: "text-danger", bar: "bg-danger" },
  info: { icon: Info, ring: "text-info", bar: "bg-info" },
  warning: { icon: AlertTriangle, ring: "text-warning", bar: "bg-warning" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (kind: ToastItem["kind"], title: string, message?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-4), { id, kind, title, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const api = useMemo<ToastCtx>(
    () => ({
      toast,
      success: (title, message) => toast("success", title, message),
      error: (title, message) => toast("error", title, message),
      info: (title, message) => toast("info", title, message),
      warning: (title, message) => toast("warning", title, message),
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => {
          const m = META[t.kind];
          const Icon = m.icon;
          return (
            <div
              key={t.id}
              role="status"
              className="anim-slide-up pointer-events-auto flex items-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface/95 p-3.5 shadow-[var(--shadow-pop)] backdrop-blur-xl"
            >
              <span className={cn("mt-0.5 shrink-0 rounded-full p-1", t.kind === "success" && "bg-oksoft", t.kind === "error" && "bg-errsoft", t.kind === "info" && "bg-infosoft", t.kind === "warning" && "bg-warnsoft")}>
                <Icon className={cn("h-4 w-4", m.ring)} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.message && <p className="mt-0.5 text-[13px] leading-snug text-mute">{t.message}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-soft transition hover:bg-s3 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
