import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  HardDrive,
  History,
  LayoutTemplate,
  Plus,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import UploadZone from "../components/UploadZone";
import DocumentProcessingModal from "../components/DocumentProcessingModal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FileGlyph,
  Skeleton,
  TRANS_META,
  badgeTone,
  formatBytes,
  greeting,
  timeAgo,
} from "../components/ui";
import { cn } from "../utils/cn";
import type { AppFile, FileKind, TransformationId } from "../types";

const STATUS_TONE: Record<string, string> = {
  Completed: badgeTone.success,
  Processing: badgeTone.warning,
  Draft: badgeTone.neutral,
};
function UploadedFileCard({ file, onRemove }: { file: AppFile; onRemove: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 border-t-slate-300 dark:border-t-white/30 bg-slate-50/80 dark:bg-white/[0.03] backdrop-blur-xl p-4 flex items-center justify-between transition-all duration-200">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 p-2.5 rounded-xl flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{file.name}</p>
          <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
            {file.kind.toUpperCase()} • {formatBytes(file.size)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
        </div>
        <button
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="text-slate-400 hover:text-rose-500 dark:text-gray-400 dark:hover:text-rose-400 p-1.5 rounded-lg transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tint }: { icon: any; label: string; value: string; sub: string; tint: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200 dark:border-white/10 border-t-slate-300 dark:border-t-white/30 bg-slate-50/80 dark:bg-white/[0.03] p-5 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all">
      <div className="flex items-center gap-3.5">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105", tint)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xl leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-600 dark:text-gray-400">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-medium text-slate-500 dark:text-gray-500">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const { sessionFiles, removeSessionFile, addFiles, setSelectedTransformation, setSelectedTransformations, setGenerated, recents, recentTransformations, stats, library, openInWorkspace, markOpened, uploadProcessingStatus, processingFile, processingError, resetProcessingState } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const zoneRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  const readyFiles = sessionFiles.filter((f) => f.status === "ready");
  const hasReady = readyFiles.length > 0;
  const storageGB = library.reduce((sum, f) => sum + (f.size || 0), 0) / (1024 * 1024 * 1024);
  const firstName = (user?.name || "there").split(" ")[0];
  const dept = user?.org || "Government Department";

  const quickPick = (id: TransformationId) => {
    setSelectedTransformation(id);
    setSelectedTransformations([id]);

    if (hasReady) {
      const target = readyFiles[0];
      const fid = target?.fileId || target?.id || "unknown";
      const docId = target?.document_id || fid;
      console.log(`[ERA UPLOAD] document_id received ${docId}`);
      console.log(`[ERA UPLOAD] transformation preserved ${id}`);
      console.log("[ERA UPLOAD] navigating to configure");
      toast.success(`${TRANS_META[id].label} selected`, "Opening configuration...");
      navigate("/workspace/configure");
    } else {
      toast.info(`${TRANS_META[id].label} selected`, "Now choose or drop your document below to begin.");
      zoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const openRecent = (r: { name: string; kind: FileKind }) => {
    const existing = library.find((f) => f.filename === r.name || f.title === r.name || f.name === r.name);
    if (existing) {
      openInWorkspace(existing);
    } else {
      const now = new Date().toISOString();
      const mockFile: AppFile = {
        id: r.name,
        fileId: r.name,
        filename: r.name,
        name: r.name,
        title: r.name,
        kind: r.kind,
        extension: r.kind,
        fileType: "application/pdf",
        size: 1024 * 1024,
        ownerId: user?.user_id || "anonymous",
        ownerName: user?.name || "You",
        ownerEmail: user?.email || "",
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        status: "ready",
        transformations: [],
        sharedWith: [],
        source: "upload",
      };
      openInWorkspace(mockFile);
    }
    setSelectedTransformation(null);
    setGenerated(null);
    markOpened(r);
    navigate("/workspace/configure");
  };

  const recentRows = [...recentTransformations.slice(0, 4), ...recents.filter((r) => r.activity === "transformed").slice(0, 3).map((r) => ({ id: r.id, source: r.name, target: r.transformation ?? "Transformation", status: "Completed", time: r.modified }))].slice(0, 5);

  if (!ready) {
    return (
      <div className="space-y-5 max-w-6xl mx-auto px-4">
        <div>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-[340px] w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 py-4">
      {/* Greeting */}
      <div className="anim-slide-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {greeting()}, <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent font-bold">{firstName}</span>
          </h1>
          <p className="mt-1 text-slate-600 dark:text-gray-400 text-sm">Transform your government documents into useful content.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Government Workspace
          </div>
          <div className="border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300 px-3.5 py-1.5 rounded-full text-xs font-semibold">
            {user?.role || "Administrator"}
          </div>
        </div>
      </div>

      {/* Primary upload */}
      <div ref={zoneRef} className="anim-slide-up" style={{ animationDelay: "40ms" }}>
        <UploadZone
          onFiles={async (files) => {
            try {
              console.log(`[ERA UPLOAD] file selected ${files[0]?.name || ""}`);
              await addFiles(files);
            } catch (err: any) {
              console.error("[ERA UPLOAD HANDOFF ERROR]:", err);
            }
          }}
        />
      </div>

      {/* Uploaded files */}
      {sessionFiles.length > 0 && (
        <div className="anim-slide-up space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Files added</h2>
            <span className="text-xs font-medium text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/10">
              {sessionFiles.length} file{sessionFiles.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2.5">
            {sessionFiles.map((f) => (
              <UploadedFileCard key={f.id} file={f} onRemove={() => removeSessionFile(f.id)} />
            ))}
          </div>

          {/* Continue to workspace */}
          <div
            className={cn(
              "rounded-2xl border border-slate-200 dark:border-white/10 border-t-slate-300 dark:border-t-white/30 bg-slate-50/80 dark:bg-white/[0.03] backdrop-blur-xl p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between transition-all",
              hasReady && "border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-transparent"
            )}
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
                <LayoutTemplate className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {readyFiles.length} document{readyFiles.length !== 1 ? "s" : ""} {hasReady ? "ready" : "uploading"}
                </p>
                <p className="truncate text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                  {hasReady ? "Next: choose what you want to create in the workspace." : "Waiting for upload to finish…"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!hasReady && (
                <Button variant="secondary" onClick={() => zoneRef.current?.scrollIntoView({ behavior: "smooth" })} icon={<Plus className="h-4 w-4" />}>
                  Add more files
                </Button>
              )}
              <Button variant="primary" size="lg" disabled={!hasReady} onClick={() => navigate("/workspace/configure")}>
                Continue to Workspace <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Cards Grid */}
      <div className="anim-slide-up space-y-3.5" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Transformations</h2>
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">Popular work types for government documents.</p>
          </div>
          {hasReady && (
            <button onClick={() => navigate("/workspace/configure")} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition">
              See all work types <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => quickPick("executive-brief")}
            className="rounded-2xl border border-slate-200 dark:border-white/10 border-t-slate-300 dark:border-t-white/30 bg-slate-50/80 dark:bg-white/[0.03] p-5 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer group flex flex-col justify-between space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileText className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white transition" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">Executive Brief</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">Draft into a leadership summary</p>
            </div>
          </div>

          <div
            onClick={() => quickPick("meeting-notes")}
            className="rounded-2xl border border-slate-200 dark:border-white/10 border-t-slate-300 dark:border-t-white/30 bg-slate-50/80 dark:bg-white/[0.03] p-5 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer group flex flex-col justify-between space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <LayoutTemplate className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white transition" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">Meeting Notes</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">Extract action items & decisions</p>
            </div>
          </div>

          <div
            onClick={() => quickPick("linkedin")}
            className="rounded-2xl border border-slate-200 dark:border-white/10 border-t-slate-300 dark:border-t-white/30 bg-slate-50/80 dark:bg-white/[0.03] p-5 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer group flex flex-col justify-between space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white transition" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">Social Post</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">Draft a public-facing announcement</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent files */}
      <div className="anim-slide-up" style={{ animationDelay: "120ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-ink">Recent Files</h2>
            <p className="text-[13px] text-mute">Documents you open or transform will appear here.</p>
          </div>
          <Link to="/recents" className="flex items-center gap-1 text-[13px] font-semibold text-brandink transition hover:underline">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {recents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="No recent documents"
              description="Upload a document to start transforming your content."
              action={
                <Button variant="primary" onClick={() => zoneRef.current?.scrollIntoView({ behavior: "smooth" })}>
                  <Plus className="h-4 w-4" /> Add files
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {recents.slice(0, 4).map((r) => (
              <button key={r.id} onClick={() => openRecent(r)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition hover:bg-s2 sm:px-5">
                <FileGlyph kind={r.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="text-xs text-mute">
                    {r.kind.toUpperCase()} · {r.transformation ?? "Opened"} · {timeAgo(r.modified)}
                  </p>
                </div>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-soft sm:block" />
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Recent transformations */}
      <div className="anim-slide-up" style={{ animationDelay: "160ms" }}>
        <div className="mb-3">
          <h2 className="text-[17px] font-bold text-ink">Recent Transformations</h2>
          <p className="text-[13px] text-mute">Your latest generated outputs across work types.</p>
        </div>
        {recentRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="No transformations yet"
              description="Generate an Executive Brief, LinkedIn Post or Report and it will appear here."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {recentRows.map((r) => (
              <button key={r.id} onClick={() => navigate("/recents")} className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition hover:bg-s2 sm:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brandsoft text-brandink">
                  <FileText className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {r.source.replace(/\.[^.]+$/, "")} <span className="text-soft">→</span> <span className="text-brandink">{r.target}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-mute">
                    <Clock className="h-3 w-3" /> {timeAgo(r.time)}
                  </p>
                </div>
                <Badge className={STATUS_TONE[r.status] ?? badgeTone.neutral}>{r.status}</Badge>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-soft sm:block" />
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Activity */}
      <div className="anim-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="mb-3">
          <h2 className="text-[17px] font-bold text-ink">Your Activity</h2>
          <p className="text-[13px] text-mute">Your document transformation activity at a glance.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={FileText} label="Documents Processed" value={String(stats.documents)} sub="Across your department" tint="bg-gradient-to-br from-indigo-500 to-violet-600" />
          <Stat icon={Sparkles} label="Transformations" value={String(stats.transformations)} sub="Briefs, reports & social" tint="bg-gradient-to-br from-violet-500 to-fuchsia-600" />
          <Stat icon={TrendingUp} label="Hours Saved" value={`${stats.hours.toFixed(1)} hrs`} sub="Estimated manual hours" tint="bg-gradient-to-br from-emerald-500 to-teal-600" />
          <Stat icon={HardDrive} label="Files" value={`${storageGB.toFixed(2)} GB`} sub="of 10 GB workspace" tint="bg-gradient-to-br from-sky-500 to-blue-600" />
        </div>
        <p className="mt-4 text-center text-[11px] text-soft">
          {dept} · {firstName}'s workspace · Your workspace is private.
        </p>
      </div>

      <DocumentProcessingModal
        status={uploadProcessingStatus}
        file={processingFile}
        error={processingError}
        onChooseTransformation={() => {
          resetProcessingState();
          navigate("/workspace/configure");
        }}
        onOpenWorkspace={() => {
          resetProcessingState();
          navigate("/workspace/select");
        }}
        onRetry={() => {
          resetProcessingState();
        }}
      />
    </div>
  );
}
