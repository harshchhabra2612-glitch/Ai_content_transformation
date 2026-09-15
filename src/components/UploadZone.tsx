import { useRef, useState, type DragEvent } from "react";
import { CloudUpload, FileUp, FolderPlus } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { cn } from "../utils/cn";
import type { FileKind } from "../types";

export interface PickedFile {
  name: string;
  kind: FileKind;
  size: number;
  rawFile?: File;
}

export const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.txt";
export const MAX_MB = 25;

const KIND_FROM_EXT: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  xlsx: "xlsx",
  txt: "txt",
};

export function validateFiles(files: File[]): PickedFile[] {
  const valid: PickedFile[] = [];
  for (const f of files) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const kind = KIND_FROM_EXT[ext];
    const size = f.size;
    // size checks
    if (size > MAX_MB * 1024 * 1024) {
      // oversize flagged by caller via returned meta? Simpler: caller toasts
    }
    if (kind && size <= MAX_MB * 1024 * 1024) {
      valid.push({ name: f.name, kind, size, rawFile: f });
    }
  }
  return valid;
}

export default function UploadZone({
  onFiles,
  compact,
  className,
  title = "Upload your document",
  subtitle = "Add a file to start transforming your content",
  multiple = true,
}: {
  onFiles: (files: PickedFile[]) => void;
  compact?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  multiple?: boolean;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const dragDepth = useRef(0);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const rejectedType: string[] = [];
    const rejectedSize: string[] = [];
    const valid: PickedFile[] = [];

    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const kind = KIND_FROM_EXT[ext];
      if (!kind) {
        rejectedType.push(f.name);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        rejectedSize.push(f.name);
        continue;
      }
      valid.push({ name: f.name, kind, size: f.size, rawFile: f });
    }

    if (rejectedType.length) {
      toast.error("Unsupported file type", "Please upload PDF, DOCX, PPTX, XLSX or TXT files.");
    }
    if (rejectedSize.length) {
      toast.error("File is too large", `Maximum file size is ${MAX_MB} MB per file.`);
    }
    if (valid.length) {
      onFiles(multiple ? valid : valid.slice(0, 1));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDrag(false);
    handle(e.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload documents"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDrag(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDrag(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "focus-ring group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden text-center transition-all duration-300",
        compact
          ? "min-h-40 px-4 py-8 rounded-2xl border border-line bg-surface/60"
          : "min-h-[380px] max-w-4xl mx-auto px-6 py-10 rounded-[32px] bg-slate-100/70 dark:bg-white/[0.03] backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 border-t-slate-300/80 dark:border-t-white/40 shadow-[inset_0_0_24px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_0_24px_rgba(255,255,255,0.04)]",
        drag && "border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.25)]",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />

      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <span
        className={cn(
          "relative mb-3 flex items-center justify-center transition-all duration-300",
          drag
            ? "anim-float border-indigo-500 bg-indigo-500 text-white shadow-lg"
            : "w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-300 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10",
          compact ? "h-12 w-12" : "h-14 w-14"
        )}
      >
        {drag ? <FileUp className="h-7 w-7" /> : <CloudUpload className={cn("h-7 w-7", !drag && "transition-transform duration-300 group-hover:-translate-y-1")} />}
        {drag && <span className="absolute inset-0 animate-ping rounded-2xl bg-indigo-500/30" />}
      </span>

      <p className={cn("relative font-semibold text-slate-900 dark:text-white tracking-tight", compact ? "text-[15px]" : "text-2xl mt-2")}>{drag ? "Drop your files here" : title}</p>
      <p className="relative mt-1 max-w-sm text-sm text-slate-600 dark:text-gray-400 font-normal">{drag ? "Release to start uploading your documents" : subtitle}</p>

      <div className="relative mt-5 flex flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-medium px-7 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 border border-white/15 flex items-center gap-2 hover:scale-[1.02] active:scale-100 transition-all text-sm"
        >
          <FolderPlus className="h-4 w-4" /> Add files
        </button>
        <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 font-normal">or drag and drop files here</p>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
        {(["PDF", "DOCX", "PPTX", "XLSX", "TXT"] as const).map((f) => (
          <span key={f} className="bg-slate-200/60 dark:bg-white/5 border border-slate-300/60 dark:border-white/10 text-[11px] text-slate-700 dark:text-gray-300 px-3 py-1 rounded-lg font-medium tracking-wide">
            {f}
          </span>
        ))}
      </div>
      {!compact && <p className="relative mt-5 text-[11px] text-slate-500 dark:text-gray-400">Maximum file size: {MAX_MB} MB per file • Multiple files supported</p>}
    </div>
  );
}
