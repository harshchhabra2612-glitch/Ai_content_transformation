import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, FileUp, LayoutTemplate, Settings2, Eye } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../utils/cn";

const STEPS = [
  { id: "upload", label: "Upload", path: "/dashboard", icon: FileUp },
  { id: "choose", label: "Choose Work", path: "/workspace/select", icon: LayoutTemplate },
  { id: "configure", label: "Configure", path: "/workspace/configure", icon: Settings2 },
  { id: "preview", label: "Preview", path: "/workspace/preview", icon: Eye },
];

export default function WorkspaceStepper({ current }: { current: "upload" | "choose" | "configure" | "preview" }) {
  const navigate = useNavigate();
  const { sessionFiles, selectedTransformation, generated } = useApp();
  const hasFiles = sessionFiles.length > 0;
  const hasWork = !!selectedTransformation;
  const hasResult = !!generated;

  const idx = STEPS.findIndex((s) => s.id === current);

  const canGo = (stepId: string) => {
    if (stepId === "upload") return true;
    if (stepId === "choose") return hasFiles;
    if (stepId === "configure") return hasFiles && hasWork;
    if (stepId === "preview") return hasFiles && hasWork && hasResult;
    return false;
  };

  return (
    <nav aria-label="Workspace progress" className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-card)] sm:gap-0">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const enabled = canGo(s.id);
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex min-w-0 flex-1 items-center">
            <button
              onClick={() => enabled && navigate(s.path)}
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
              className={cn(
                "focus-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-[12px] font-bold transition sm:px-3 sm:text-[13px]",
                active ? "btn-gradient text-white shadow" : done ? "text-brandink hover:bg-s2" : "text-soft",
                !enabled && !active && "cursor-not-allowed opacity-60"
              )}
            >
              <span
                className={cn(
                  "flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[10px]",
                  active ? "bg-white/25 text-white" : done ? "bg-brandsoft text-brandink" : "bg-s3 text-soft"
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Icon className="h-3 w-3" />}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-line2" aria-hidden />}
          </div>
        );
      })}
    </nav>
  );
}
