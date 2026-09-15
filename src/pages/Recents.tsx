import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock, FolderOpen, History } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card, EmptyState, FileGlyph } from "../components/ui";
import { cn } from "../utils/cn";
import { formatExactDateTime } from "../utils/date";
import type { AppFile } from "../types";

type TimeFilter = "all" | "today" | "week" | "month";

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All" },
];

function inRange(iso: string, f: TimeFilter) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const day = 86400000;
  if (f === "today") return now - d < day;
  if (f === "week") return now - d < 7 * day;
  if (f === "month") return now - d < 30 * day;
  return true;
}


export default function Recents() {
  const { library, openInWorkspace, setSelectedTransformation, setGenerated } = useApp();
  const navigate = useNavigate();
  const [time, setTime] = useState<TimeFilter>("all");

  const visible = useMemo(() => {
    const sorted = [...library]
      .filter((f) => f.status !== "archived")
      .sort((a, b) => new Date(b.lastOpenedAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.lastOpenedAt || a.updatedAt || a.createdAt || 0).getTime());
    return sorted.filter((f) => inRange(f.lastOpenedAt || f.updatedAt || f.createdAt, time));
  }, [library, time]);

  const open = (f: AppFile) => {
    openInWorkspace(f);
    setSelectedTransformation(null);
    setGenerated(null);
    navigate("/workspace/configure");
  };

  return (
    <div className="space-y-5">
      <div className="anim-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Recents</h1>
          <p className="mt-1 text-[14px] text-mute">Recently opened and accessed documents sorted by last opened time.</p>
        </div>
        <Link to="/files" className="flex items-center gap-1 text-[13px] font-semibold text-brand transition hover:underline">
          Browse all files <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Table */}
      <Card className="anim-slide-up overflow-hidden" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-sm text-mute">
            <Clock className="h-4 w-4 text-soft" />
            <span>
              Showing <span className="font-bold text-ink">{visible.length}</span> recently accessed documents
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-line bg-s2/50 p-1">
            {TIME_FILTERS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTime(t.id)}
                className={cn(
                  "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer",
                  time === t.id ? "bg-surface text-ink shadow-sm" : "text-mute hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No recently opened documents"
            description="Open a document from your files library to view it here."
            action={
              <Button variant="primary" onClick={() => navigate("/files")}>
                <FolderOpen className="h-4 w-4" /> View Files Library
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-[minmax(240px,1.6fr)_90px_160px_160px_140px_90px] items-center gap-3 border-b border-line bg-s2/60 px-4 py-2.5 text-[11px] font-bold tracking-wide text-soft uppercase sm:px-5">
              <span>Document Title</span>
              <span>Type</span>
              <span>Last Opened</span>
              <span>Last Modified</span>
              <span>Created By</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-line">
              {visible.map((f) => {
                return (
                  <div key={f.id} className="grid min-w-[720px] grid-cols-[minmax(240px,1.6fr)_90px_160px_160px_140px_90px] items-center gap-3 px-4 py-3 transition hover:bg-s2 sm:px-5">
                    <button onClick={() => open(f)} className="focus-ring flex min-w-0 items-center gap-3 rounded-lg text-left cursor-pointer">
                      <FileGlyph kind={f.kind} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-bold text-ink">{f.title || f.name}</span>
                        <span className="text-[11px] text-mute font-mono truncate block">{f.filename}</span>
                      </span>
                    </button>
                    <span className="text-xs font-bold text-ink uppercase">{f.kind}</span>
                    <span className="text-xs text-brand font-semibold">{formatExactDateTime(f.lastOpenedAt || f.updatedAt)}</span>
                    <span className="text-xs text-mute">{formatExactDateTime(f.updatedAt || f.createdAt)}</span>
                    <span className="truncate text-xs text-mute font-medium">{f.ownerName || f.owner || "User"}</span>
                    <div className="flex items-center justify-end">
                      <Button variant="secondary" onClick={() => open(f)} icon={<FolderOpen className="h-3.5 w-3.5" />}>
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

