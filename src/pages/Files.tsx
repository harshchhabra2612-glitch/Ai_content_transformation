import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  FileUp,
  FolderPlus,
  Folder as FolderIcon,
  Grid2x2 as GridIcon,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Search,
  Share2,
  Star,
  Trash2,
  Eye,
  User as UserIcon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FileGlyph,
  IconButton,
  Input,
  Menu,
  Modal,
  PageSkeleton,
  Select,
  formatBytes,
  timeAgo,
  usePageReady,
} from "../components/ui";
import UploadZone from "../components/UploadZone";
import DocumentProcessingModal from "../components/DocumentProcessingModal";
import ShareModal from "../components/ShareModal";
import FileDetailsModal from "../components/FileDetailsModal";
import { formatExactDateTime } from "../utils/date";
import { cn } from "../utils/cn";
import type { AppFile } from "../types";

type Cat = "all" | "my-files" | "shared-with-me" | "recent" | "archived" | "pdfs" | "documents" | "presentations" | "spreadsheets" | "folders";
type ViewMode = "grid" | "list";
type SortKey = "modified" | "created" | "opened" | "name" | "size";

const CATS: { id: Cat; label: string }[] = [
  { id: "all", label: "All Files" },
  { id: "my-files", label: "My Files" },
  { id: "shared-with-me", label: "Shared With Me" },
  { id: "recent", label: "Recent" },
  { id: "pdfs", label: "PDFs" },
  { id: "documents", label: "Documents" },
  { id: "presentations", label: "Presentations" },
  { id: "archived", label: "Archived" },
];

function matchesCat(f: AppFile, cat: Cat, userEmail?: string, userId?: string) {
  if (cat === "archived") return f.status === "archived";
  if (f.status === "archived") return false;

  if (cat === "all") return true;
  if (cat === "my-files") return !userId || f.ownerId === userId || f.source === "upload";
  if (cat === "shared-with-me") return f.source === "shared" || (userEmail && f.sharedWithEmails?.includes(userEmail.toLowerCase()));
  if (cat === "recent") return Boolean(f.lastOpenedAt);
  if (cat === "folders") return f.folder || f.kind === "folder";

  if (f.kind === "folder") return false;
  switch (cat) {
    case "documents":
      return f.kind === "docx" || f.kind === "txt";
    case "presentations":
      return f.kind === "pptx";
    case "spreadsheets":
      return f.kind === "xlsx";
    case "pdfs":
      return f.kind === "pdf";
    default:
      return true;
  }
}

function formatDate(iso?: string): string {
  return formatExactDateTime(iso);
}

export default function Files() {
  const { library, deleteFile, renameFile, toggleStar, openInWorkspace, addToLibrary, addFolder, setSelectedTransformation, setGenerated, uploadProcessingStatus, processingFile, processingError, resetProcessingState } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Cat>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("modified");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const [renaming, setRenaming] = useState<AppFile | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [sharing, setSharing] = useState<AppFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<AppFile | null>(null);
  const [deleting, setDeleting] = useState<AppFile | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = library.filter((f) => {
      const catMatch = matchesCat(f, cat, user?.email, user?.user_id);
      if (!catMatch) return false;
      if (!q) return true;
      return (
        (f.title || "").toLowerCase().includes(q) ||
        (f.filename || "").toLowerCase().includes(q) ||
        (f.name || "").toLowerCase().includes(q) ||
        (f.kind || "").toLowerCase().includes(q) ||
        (f.ownerName || "").toLowerCase().includes(q) ||
        (f.ownerEmail || "").toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sort === "name") return (a.title || a.name).localeCompare(b.title || b.name);
      if (sort === "size") return b.size - a.size;
      if (sort === "created") return new Date(b.createdAt || b.modified || 0).getTime() - new Date(a.createdAt || a.modified || 0).getTime();
      if (sort === "opened") return new Date(b.lastOpenedAt || 0).getTime() - new Date(a.lastOpenedAt || 0).getTime();
      // default: modified
      return new Date(b.updatedAt || b.modified || 0).getTime() - new Date(a.updatedAt || a.modified || 0).getTime();
    });
  }, [library, query, cat, sort, user]);

  const open = (f: AppFile) => {
    openInWorkspace(f);
    setSelectedTransformation(null);
    setGenerated(null);
    toast.info("Opening document workspace", f.title || f.name);
    navigate("/workspace/configure");
  };

  const download = (f: AppFile) => {
    if (f.downloadUrl) {
      window.open(f.downloadUrl, "_blank");
    } else {
      const blob = new Blob([`ERA Document Content for ${f.title || f.filename}`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename || f.name;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success("Download started", f.filename || f.name);
  };

  const countFor = (c: Cat) => library.filter((f) => matchesCat(f, c, user?.email, user?.user_id)).length;

  const pageReady = usePageReady();
  if (!pageReady) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="anim-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Files</h1>
          <p className="mt-1 text-[14px] text-mute">
            Persistent workspace documents, transformation outputs, and activity.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={() => setFolderOpen(true)} icon={<FolderPlus className="h-4 w-4" />}>
            New Folder
          </Button>
          <Button variant="primary" onClick={() => setUploadOpen(true)} icon={<FileUp className="h-4 w-4" />}>
            Upload Document
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="anim-slide-up flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn(
                "focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition cursor-pointer",
                cat === c.id ? "bg-gradient-to-r from-brand to-brand2 text-white shadow" : "text-mute hover:bg-s2 hover:text-ink"
              )}
            >
              {c.label}
              <span className={cn("ml-1.5 text-[11px]", cat === c.id ? "text-white/70" : "text-soft")}>{countFor(c.id)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 lg:justify-end">
          <div className="w-full max-w-xs lg:w-60">
            <Input
              placeholder="Search title, file, creator…"
              icon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search files"
            />
          </div>
          <div className="relative w-40 shrink-0">
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort files">
              <option value="modified">Last Modified</option>
              <option value="created">Recently Created</option>
              <option value="opened">Recently Opened</option>
              <option value="name">Name A–Z</option>
              <option value="size">Largest Size</option>
            </Select>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-[10px] border border-line">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={cn("flex h-9 w-9 items-center justify-center transition cursor-pointer", view === "grid" ? "bg-brandsoft text-brand" : "text-mute hover:bg-s2")}
            >
              <GridIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label="List view"
              className={cn("flex h-9 w-9 items-center justify-center border-l border-line transition cursor-pointer", view === "list" ? "bg-brandsoft text-brand" : "text-mute hover:bg-s2")}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Main File List Grid/List View */}
      {library.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileUp className="h-6 w-6" />}
            title="No documents yet"
            description="Upload your first document to start transforming and collaborating."
            action={
              <Button variant="primary" onClick={() => setUploadOpen(true)} icon={<FileUp className="h-4 w-4" />}>
                Upload document
              </Button>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matching documents found"
            description="Try adjusting your search terms or filter view."
            action={
              <Button variant="secondary" onClick={() => { setQuery(""); setCat("all"); }}>
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((f, i) => {
            const isFolder = f.kind === "folder";
            const fileTitle = f.title || f.name || f.filename;
            const creator = f.ownerName || f.owner || "User";

            return (
              <Card
                key={f.id}
                className="anim-slide-up group flex flex-col justify-between p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] relative border border-line"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <div>
                  <div className="flex items-start justify-between">
                    {isFolder ? (
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brandsoft text-brand">
                        <FolderIcon className="h-5 w-5" />
                      </span>
                    ) : (
                      <FileGlyph kind={f.kind} className="h-11 w-11" />
                    )}

                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 transition-opacity group-hover:opacity-100">
                      {!isFolder && (
                        <IconButton label="Star" size="sm" onClick={() => toggleStar(f.id)}>
                          <Star className={cn("h-4 w-4", f.starred && "fill-amber-400 text-amber-400")} />
                        </IconButton>
                      )}
                      <Menu
                        align="right"
                        width="w-48"
                        trigger={
                          <IconButton label="More actions" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </IconButton>
                        }
                        items={[
                          { label: "Open Workspace", icon: FolderIcon, onClick: () => open(f) },
                          { label: "View Details & History", icon: Eye, onClick: () => setDetailsFile(f) },
                          { label: "Share Document", icon: Share2, onClick: () => setSharing(f) },
                          { label: "Rename Title", icon: Pencil, onClick: () => { setRenaming(f); setRenameVal(f.title || f.name); } },
                          { label: "Download", icon: Download, onClick: () => download(f) },
                          { label: "Delete", icon: Trash2, danger: true, sep: true, onClick: () => setDeleting(f) },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Document Title & Filename (Requirement 5, 6, 7) */}
                  <button onClick={() => (isFolder ? undefined : open(f))} className="focus-ring mt-3 block w-full text-left cursor-pointer">
                    <p className="truncate text-sm font-bold text-ink hover:text-brand transition">{fileTitle}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-mute font-mono">{f.filename}</p>
                  </button>
                </div>

                {/* Card Secondary Metadata (Requirement 6, 7, 8, 9) */}
                <div className="mt-4 space-y-2 border-t border-line/80 pt-3 text-[11.5px]">
                  <div className="flex items-center justify-between text-mute">
                    <span className="flex items-center gap-1 truncate font-medium">
                      <UserIcon className="h-3 w-3 text-brand" /> {creator}
                    </span>
                    <span className="font-bold text-ink">{isFolder ? "Folder" : formatBytes(f.size)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-soft">
                    <span>Created: {formatDate(f.createdAt)}</span>
                    <span className="capitalize font-semibold text-ink">
                      {f.kind.toUpperCase()}
                    </span>
                  </div>

                  {/* Status & Sharing Badge */}
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                        f.status === "ready"
                          ? "bg-emerald-100 text-emerald-800"
                          : f.status === "processing"
                          ? "bg-amber-100 text-amber-800"
                          : f.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {f.status || "ready"}
                    </span>

                    <span className="text-[10.5px] font-medium text-mute">
                      {f.sharedWith && f.sharedWith.length > 0 ? (
                        <span className="text-brand font-bold">Shared ({f.sharedWith.length})</span>
                      ) : (
                        "Private"
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Detailed List View (Requirement 5) */
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2fr)_1fr_120px_130px_100px_44px] items-center gap-3 border-b border-line bg-s2/60 px-4 py-2.5 text-[11px] font-bold tracking-wide text-soft uppercase sm:px-5">
            <span>Document Title & Filename</span>
            <span>Created By</span>
            <span>Created / Modified</span>
            <span>Type & Status</span>
            <span>Sharing</span>
            <span />
          </div>
          <div className="divide-y divide-line">
            {visible.map((f) => {
              const isFolder = f.kind === "folder";
              const fileTitle = f.title || f.name || f.filename;
              const creator = f.ownerName || f.owner || "User";

              return (
                <div key={f.id} className="grid grid-cols-[minmax(0,2fr)_1fr_120px_130px_100px_44px] items-center gap-3 px-4 py-3 transition hover:bg-s2/50 sm:px-5">
                  <button onClick={() => (isFolder ? undefined : open(f))} className="flex min-w-0 items-center gap-3 text-left focus-ring rounded-lg cursor-pointer">
                    <FileGlyph kind={f.kind} folder={isFolder} className="h-9 w-9 shrink-0" />
                    <div className="min-w-0">
                      <span className="block truncate text-xs sm:text-[13.5px] font-bold text-ink hover:text-brand transition">{fileTitle}</span>
                      <span className="block truncate text-[11px] text-mute font-mono">{f.filename}</span>
                    </div>
                  </button>

                  <div className="min-w-0 text-xs">
                    <span className="block truncate font-semibold text-ink">{creator}</span>
                    <span className="block truncate text-[10.5px] text-soft">{f.ownerEmail}</span>
                  </div>

                  <div className="text-[11.5px] text-mute">
                    <span className="block font-medium">{formatDate(f.createdAt)}</span>
                    <span className="block text-[10.5px] text-soft">Mod: {timeAgo(f.updatedAt || f.modified || "")}</span>
                  </div>

                  <div>
                    <span className="block text-xs font-bold text-ink uppercase">{f.kind} · {formatBytes(f.size)}</span>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase mt-0.5",
                        f.status === "ready"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {f.status || "ready"}
                    </span>
                  </div>

                  <div className="text-xs">
                    {f.sharedWith && f.sharedWith.length > 0 ? (
                      <span className="text-brand font-bold block">Shared ({f.sharedWith.length})</span>
                    ) : (
                      <span className="text-mute block">Private</span>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <Menu
                      align="right"
                      width="w-48"
                      trigger={
                        <IconButton label="More actions" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </IconButton>
                      }
                      items={[
                        { label: "Open Workspace", icon: FolderIcon, onClick: () => open(f) },
                        { label: "View Details & History", icon: Eye, onClick: () => setDetailsFile(f) },
                        { label: "Share Document", icon: Share2, onClick: () => setSharing(f) },
                        { label: "Rename Title", icon: Pencil, onClick: () => { setRenaming(f); setRenameVal(f.title || f.name); } },
                        { label: "Download", icon: Download, onClick: () => download(f) },
                        { label: "Delete", icon: Trash2, danger: true, sep: true, onClick: () => setDeleting(f) },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Upload modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload documents" description="Add documents to your workspace. Binary files upload directly to Firebase Storage.">
        <UploadZone
          compact
          onFiles={(files) => {
            addToLibrary(files);
            setUploadOpen(false);
          }}
        />
      </Modal>

      {/* New Folder Modal */}
      <Modal open={folderOpen} onClose={() => setFolderOpen(false)} title="New folder" description="Create a folder for workspace organisation." size="sm">
        <Input
          autoFocus
          placeholder="e.g. Governance & Policy"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && folderName.trim()) {
              addFolder(folderName.trim());
              setFolderName("");
              setFolderOpen(false);
            }
          }}
        />
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setFolderOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!folderName.trim()}
            onClick={() => {
              addFolder(folderName.trim());
              setFolderName("");
              setFolderOpen(false);
            }}
          >
            <FolderPlus className="h-4 w-4" /> Create folder
          </Button>
        </div>
      </Modal>

      {/* Rename Document Title Modal (Requirement 7) */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Edit Document Title" description={`Editing title for ${renaming?.filename}`} size="sm">
        <div className="space-y-3 text-left">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Document Title</label>
            <Input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
            <p className="mt-1 text-[11px] text-soft">Note: Renaming the document title will NOT change the actual Storage filename ({renaming?.filename}).</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!renameVal.trim()}
            onClick={() => {
              if (renaming) renameFile(renaming.id, renameVal.trim());
              setRenaming(null);
            }}
          >
            Save Title
          </Button>
        </div>
      </Modal>

      {/* Real Share Modal (Requirement 17, 18, 19) */}
      <ShareModal file={sharing} open={!!sharing} onClose={() => setSharing(null)} />

      {/* File Details Workspace Modal (Requirement 10) */}
      <FileDetailsModal
        file={detailsFile}
        open={!!detailsFile}
        onClose={() => setDetailsFile(null)}
        onOpenWorkspace={(f) => open(f)}
        onShare={(f) => setSharing(f)}
        onRename={(f) => { setRenaming(f); setRenameVal(f.title || f.name); }}
        onDelete={(f) => setDeleting(f)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteFile(deleting.id)}
        title="Delete document?"
        message={`${deleting?.title || deleting?.name || "This file"} will be permanently removed from Cloud Firestore and Firebase Storage. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

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
