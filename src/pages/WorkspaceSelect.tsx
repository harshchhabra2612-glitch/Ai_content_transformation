import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, FileText, LayoutTemplate, Lock, Sparkles, Square, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import WorkspaceStepper from "../components/WorkspaceStepper";
import { COMING_SOON_TRANSFORMATIONS, QUICK_TRANSFORMATIONS, TRANSFORMATIONS } from "../data/mock";
import { Badge, Button, Card, EmptyState, FileGlyph, TRANS_META, TransformationGlyph, badgeTone, formatBytes } from "../components/ui";
import { cn } from "../utils/cn";
import type { AppFile, TransformationId } from "../types";

function readSessionStorageDocument(): AppFile | null {
  try {
    const raw = sessionStorage.getItem("era_workspace_current_document");
    if (raw) return JSON.parse(raw) as AppFile;

    const rawArr = sessionStorage.getItem("era-session-files");
    if (rawArr) {
      const arr = JSON.parse(rawArr) as AppFile[];
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function WorkspaceSelect() {
  const { sessionFiles, activeFile, library, selectedTransformations, setSelectedTransformations, setGenerated, removeSessionFile, openInWorkspace } = useApp();
  const { loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<TransformationId[]>(selectedTransformations);
  const [attemptedRecovery, setAttemptedRecovery] = useState(false);

  const readyFiles = sessionFiles.filter((f) => f.status === "ready");

  useEffect(() => {
    console.log("[ERA SELECT] Workspace initialized");

    if (readyFiles.length === 0 && !attemptedRecovery) {
      const sessionDoc = readSessionStorageDocument();
      if (sessionDoc) {
        const fid = sessionDoc.fileId || sessionDoc.id;
        console.log(`[ERA SELECT] Document recovered: fileId=${fid} filename=${sessionDoc.filename || sessionDoc.name}`);
        openInWorkspace(sessionDoc);
      } else if (activeFile) {
        const fid = activeFile.fileId || activeFile.id;
        console.log(`[ERA SELECT] Document recovered: fileId=${fid} filename=${activeFile.filename || activeFile.name}`);
        openInWorkspace(activeFile);
      } else if (library.length > 0) {
        const firstLib = library[0];
        const fid = firstLib.fileId || firstLib.id;
        console.log(`[ERA SELECT] Document recovered: fileId=${fid} filename=${firstLib.filename || firstLib.name}`);
        openInWorkspace(firstLib);
      }
      setAttemptedRecovery(true);
    }
  }, [readyFiles.length, activeFile, library, openInWorkspace, attemptedRecovery]);

  if (readyFiles.length === 0) {
    if (authLoading || (library.length === 0 && !attemptedRecovery)) {
      return (
        <div className="space-y-5">
          <WorkspaceStepper current="choose" />
          <Card className="p-8 text-center">
            <p className="text-sm font-bold text-ink animate-pulse">Loading workspace document…</p>
            <p className="mt-1 text-xs text-mute">Checking document session & Firestore metadata</p>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <WorkspaceStepper current="choose" />
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No documents selected"
            description="Upload a government document on the Dashboard to begin choosing work types."
            action={
              <Button variant="primary" onClick={() => navigate("/dashboard")}>
                + Add files
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const toggle = (id: TransformationId) => {
    setGenerated(null);
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    setSelectedTransformations(next);
  };

  const selectQuickTransformations = () => {
    setGenerated(null);
    setPicked(QUICK_TRANSFORMATIONS);
    setSelectedTransformations(QUICK_TRANSFORMATIONS);
    toast.success("Quick Transformations selected", `${QUICK_TRANSFORMATIONS.length} options selected.`);
  };

  const clearAll = () => {
    setPicked([]);
    setSelectedTransformations([]);
  };

  const continueNext = () => {
    if (picked.length === 0) {
      toast.info("Choose at least one work type", "Select one or more options to continue.");
      return;
    }
    const currentFid = readyFiles[0]?.fileId || readyFiles[0]?.id;
    console.log("[BEFORE NAVIGATION]", `fileId=${currentFid}`, `transformation=${picked.join(",")}`);
    setSelectedTransformations(picked);
    navigate("/workspace/configure");
  };

  const RECOMMENDED = new Set<string>(["executive-brief", "photo-generation", "video-generation", "linkedin", "twitter"]);

  return (
    <div className="space-y-5">
      <div className="anim-slide-up">
        <button
          onClick={() => navigate("/dashboard")}
          className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-mute transition hover:border-line2 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand uppercase">ERA Workspace · Step 2</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[26px]">Choose what you want to create</h1>
            <p className="mt-1 text-[14px] text-mute">Select one or multiple options (e.g. Photo Generation, Video Generation, Twitter Post, Executive Brief).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="soft" size="sm" onClick={selectQuickTransformations} icon={<Sparkles className="h-3.5 w-3.5" />}>
              Select Quick Transformations
            </Button>
            {picked.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear selection
              </Button>
            )}
          </div>
        </div>
      </div>
      <WorkspaceStepper current="choose" />

      {/* Selected documents */}
      <Card className="anim-slide-up overflow-hidden" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center justify-between border-b border-line px-4.5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-bold text-ink">Selected Documents</h2>
          </div>
          <Badge className={badgeTone.brand}>
            {readyFiles.length} document{readyFiles.length > 1 ? "s" : ""} ready
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2.5 p-3.5">
          {readyFiles.map((f) => (
            <div key={f.id} className="anim-scale-in flex items-center gap-2.5 rounded-xl border border-line bg-s2/50 py-2 pr-2 pl-2.5">
              <FileGlyph kind={f.kind} className="h-7 w-7" />
              <div className="min-w-0">
                <p className="max-w-52 truncate text-[12.5px] font-semibold text-ink">{f.name}</p>
                <p className="text-[10.5px] text-mute">{f.kind.toUpperCase()} · {formatBytes(f.size)}</p>
              </div>
              <button
                onClick={() => removeSessionFile(f.id)}
                aria-label={`Remove ${f.name}`}
                className="rounded-md p-1 text-soft transition hover:bg-errsoft hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-dashed border-line2 px-3.5 text-[12.5px] font-semibold text-mute transition hover:border-brand hover:text-brandink"
          >
            + Add more
          </button>
        </div>
      </Card>

      {/* Work types grid */}
      <div className="anim-slide-up space-y-3.5" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-ink">Select Transformations</h2>
            <p className="text-[13px] text-mute">You can check multiple options to generate content simultaneously.</p>
          </div>
          <span className="text-xs font-semibold text-brandink">
            {picked.length} selected
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TRANSFORMATIONS.map((t, i) => {
            const active = picked.includes(t.id);
            const isMedia = t.id === "photo-generation" || t.id === "video-generation";
            const social = t.id === "linkedin" || t.id === "linkedin-story" || t.id === "twitter" || isMedia;
            const recommended = RECOMMENDED.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                style={{ animationDelay: `${i * 20}ms` }}
                aria-pressed={active}
                className={cn(
                  "anim-slide-up focus-ring group relative rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer",
                  active
                    ? "border-brand bg-brandsoft/60 shadow-[0_8px_24px_-10px_rgba(79,70,229,0.45)] ring-1 ring-brand/30"
                    : "border-line bg-surface hover:-translate-y-0.5 hover:border-line2 hover:shadow-[var(--shadow-card)]"
                )}
              >
                <div className="absolute top-3.5 right-3.5 flex items-center justify-center text-brand">
                  {active ? (
                    <span className="anim-pop flex h-5.5 w-5.5 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand2 text-white shadow">
                      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                    </span>
                  ) : (
                    <Square className="h-5 w-5 text-soft transition-colors group-hover:text-mute" />
                  )}
                </div>
                <div className="flex items-start gap-3.5">
                  <TransformationGlyph id={t.id} />
                  <div className="min-w-0 flex-1 pr-6">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-bold text-ink">
                      {t.label}
                      {recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warnsoft px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-warning uppercase">
                          <Sparkles className="h-2.5 w-2.5" /> Featured
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-mute">{t.description}</p>
                    {isMedia && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10.5px] font-bold text-purple-600 dark:text-purple-300">
                        <Sparkles className="h-3 w-3" /> AI Visual & Media Studio
                      </span>
                    )}
                    {social && !isMedia && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-infosoft px-2.5 py-0.5 text-[10.5px] font-bold text-info">
                        <LayoutTemplate className="h-3 w-3" /> Platform preview available
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Coming soon */}
          {COMING_SOON_TRANSFORMATIONS.map((c) => (
            <div key={c.label} aria-disabled className="relative cursor-not-allowed rounded-2xl border border-dashed border-line bg-s2/40 p-4 text-left opacity-60">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-soft ring-1 ring-line">
                  <Lock className="h-5 w-5" />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
                    {c.label}
                    <span className="rounded-full bg-s3 px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-mute uppercase">Coming Soon</span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-mute">{c.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary & Continue */}
      <Card className={cn("anim-slide-up flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between", picked.length > 0 && "border-brand/40 bg-gradient-to-r from-brandsoft/50 to-transparent")} style={{ animationDelay: "120ms" }}>
        <div className="flex min-w-0 items-center gap-3">
          {picked.length > 0 ? (
            <>
              <div className="flex -space-x-2 overflow-hidden">
                {picked.slice(0, 4).map((id) => (
                  <TransformationGlyph key={id} id={id} className="h-9 w-9 ring-2 ring-surface" />
                ))}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">
                  {picked.length} transformation{picked.length > 1 ? "s" : ""} selected
                </p>
                <p className="truncate text-xs text-mute">
                  {picked.map((id) => TRANS_META[id].label).join(", ")}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-s2 text-mute ring-1 ring-line">
                <LayoutTemplate className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">No work type selected</p>
                <p className="text-xs text-mute">Select one or more work types above to continue.</p>
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {picked.length === 0 && <span className="hidden text-xs font-medium text-mute sm:block">Select at least one work type to continue →</span>}
          <Button variant="primary" size="lg" onClick={continueNext} disabled={picked.length === 0}>
            Continue ({picked.length}) <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
