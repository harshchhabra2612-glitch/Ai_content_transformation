import { Calendar, Clock, FileText, User as UserIcon } from "lucide-react";
import { formatExactDateTime } from "../utils/date";

export interface DocumentMetadataProps {
  sourceDocument?: { filename?: string; title?: string; document_id?: string } | string;
  creator?: { uid?: string; name?: string; email?: string } | string;
  createdAt?: string;
  updatedAt?: string;
  documentId?: string;
  transformation?: string;
  headerTitle?: string;
  kicker?: string;
  className?: string;
  compact?: boolean;
}

export function DocumentMetadata({
  sourceDocument,
  creator,
  createdAt,
  updatedAt,
  headerTitle,
  kicker,
  className = "",
  compact = false,
}: DocumentMetadataProps) {
  let sourceFileName = "";
  let sourceDocTitle = "";

  if (typeof sourceDocument === "string") {
    sourceFileName = sourceDocument;
  } else if (sourceDocument) {
    sourceFileName = sourceDocument.filename || "";
    sourceDocTitle = sourceDocument.title || "";
  }

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
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-mute ${className}`}>
        {sourceFileName && (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <FileText className="h-3.5 w-3.5 text-brand" />
            <span className="text-soft">Source:</span>
            <span className="font-semibold text-ink">{sourceFileName}</span>
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
    );
  }

  return (
    <div className={`rounded-xl border border-line bg-s2/40 p-4 text-xs ${className}`}>
      {(kicker || headerTitle) && (
        <div className="mb-3 border-b border-line/60 pb-2.5">
          {kicker && <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand">{kicker}</p>}
          {headerTitle && <h3 className="mt-0.5 text-base font-extrabold text-ink">{headerTitle}</h3>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sourceFileName && (
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-mute">Source Document</p>
              {sourceDocTitle && sourceDocTitle !== sourceFileName && (
                <p className="font-bold text-ink truncate text-[13px]">{sourceDocTitle}</p>
              )}
              <p className="font-medium text-ink font-mono text-[11.5px] truncate">{sourceFileName}</p>
            </div>
          </div>
        )}

        {creatorName && (
          <div className="flex items-start gap-2.5">
            <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-mute">Created By</p>
              <p className="font-bold text-ink truncate text-[13px]">{creatorName}</p>
            </div>
          </div>
        )}

        {createdStr && (
          <div className="flex items-start gap-2.5">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-mute">Created</p>
              <p className="font-bold text-ink text-[12.5px]">{createdStr}</p>
            </div>
          </div>
        )}

        {updatedStr && (
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-mute">Last Modified</p>
              <p className="font-bold text-ink text-[12.5px]">{updatedStr}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
