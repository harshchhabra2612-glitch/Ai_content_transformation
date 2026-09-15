import { Calendar, Clock, FileText, Sparkles, User as UserIcon } from "lucide-react";
import { formatExactDateTime } from "../utils/date";
import { EraLogo } from "./branding/EraLogo";

export function getCleanDocTitle(title?: string, filename?: string): string {
  if (title && title.trim() && !title.endsWith(".pdf") && !title.endsWith(".docx") && !title.endsWith(".pptx") && !title.endsWith(".txt")) {
    return title.trim();
  }
  if (filename) {
    return filename
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
      .join(" ");
  }
  return "Document";
}

export function getMetaTitle(docTitle?: string, filename?: string, transformationLabel?: string): string {
  const cleanTitle = getCleanDocTitle(docTitle, filename);
  if (!transformationLabel || transformationLabel === "Original Document") {
    return `${cleanTitle} — Original Document`;
  }
  return `${cleanTitle} — ${transformationLabel}`;
}

export interface DocumentMetaHeaderProps {
  docTitle?: string;
  filename?: string;
  transformationLabel?: string;
  creator?: { name?: string; email?: string } | string;
  createdAt?: string;
  updatedAt?: string;
  className?: string;
  compact?: boolean;
}

export function DocumentMetaHeader({
  docTitle,
  filename,
  transformationLabel = "Summary",
  creator,
  createdAt,
  updatedAt,
  className = "",
  compact = false,
}: DocumentMetaHeaderProps) {
  const metaTitle = getMetaTitle(docTitle, filename, transformationLabel);
  const sourceFileName = filename || (docTitle && (docTitle.endsWith(".pdf") || docTitle.endsWith(".docx")) ? docTitle : "source_document.pdf");

  let creatorName = "";
  if (typeof creator === "string") {
    creatorName = creator;
  } else if (creator) {
    creatorName = creator.name || creator.email || "";
  }

  const createdStr = createdAt ? formatExactDateTime(createdAt) : null;
  const updatedStr = updatedAt && updatedAt !== createdAt ? formatExactDateTime(updatedAt) : null;

  if (compact) {
    return (
      <div className={`rounded-xl border border-line bg-s2/60 p-3.5 text-xs text-ink transition-colors ${className}`}>
        <p className="font-extrabold text-ink text-sm truncate tracking-tight">{metaTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-mute">
          {sourceFileName && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <FileText className="h-3.5 w-3.5 text-brand" />
              <span className="text-soft">Source:</span>
              <span className="font-semibold text-ink font-mono">{sourceFileName}</span>
            </span>
          )}
          {creatorName && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <UserIcon className="h-3.5 w-3.5 text-brand" />
              <span className="text-soft">Created by:</span>
              <span className="font-semibold text-ink">{creatorName}</span>
            </span>
          )}
          {createdStr && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Calendar className="h-3.5 w-3.5 text-brand" />
              <span className="text-soft">Created:</span>
              <span className="font-semibold text-ink">{createdStr}</span>
            </span>
          )}
          {updatedStr && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-brand" />
              <span className="text-soft">Last modified:</span>
              <span className="font-semibold text-ink">{updatedStr}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 text-xs text-ink shadow-sm transition-colors ${className}`}>
      {/* Meta Title */}
      <div className="mb-4 border-b border-line/80 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brandsoft px-3 py-1 text-[10.5px] font-extrabold text-brandink uppercase tracking-wider border border-brand/20">
            <Sparkles className="h-3 w-3" /> {transformationLabel.toUpperCase()}
          </span>
          <span className="text-[11px] font-semibold text-mute inline-flex items-center gap-1.5">
            <EraLogo variant="mark" size="xs" /> Workspace Record
          </span>
        </div>
        <h1 className="mt-2.5 text-lg sm:text-xl font-extrabold text-ink tracking-tight">{metaTitle}</h1>
      </div>

      {/* Metadata Attributes Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sourceFileName && (
          <div className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-s2/50 p-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-mute">Source Document</p>
              <p className="font-bold text-ink font-mono text-[11.5px] truncate">{sourceFileName}</p>
            </div>
          </div>
        )}

        {creatorName && (
          <div className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-s2/50 p-2.5">
            <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-mute">Created By</p>
              <p className="font-bold text-ink text-[12.5px] truncate">{creatorName}</p>
            </div>
          </div>
        )}

        {createdStr && (
          <div className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-s2/50 p-2.5">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-mute">Created</p>
              <p className="font-bold text-ink text-[12.5px]">{createdStr}</p>
            </div>
          </div>
        )}

        {updatedStr ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-s2/50 p-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-mute">Last Modified</p>
              <p className="font-bold text-ink text-[12.5px]">{updatedStr}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-s2/50 p-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-mute">Transformation</p>
              <p className="font-bold text-ink text-[12.5px] truncate">{transformationLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
