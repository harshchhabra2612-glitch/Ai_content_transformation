import { Calendar, Clock, CheckCircle2, ListOrdered, Table, ArrowRight } from "lucide-react";
import type { StructuredMeetingNotes } from "../types";
import { cn } from "../utils/cn";
import { DocumentMetaHeader } from "./DocumentMetaHeader";

export function parseMeetingNotesData(content: string): StructuredMeetingNotes | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.transformation === "meeting_notes" || parsed.overview || parsed.action_items) {
        return parsed as StructuredMeetingNotes;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export default function MeetingNotesRenderer({
  data,
  rawContent,
  creatorName,
  sourceFilename,
}: {
  data?: StructuredMeetingNotes | null;
  rawContent?: string;
  creatorName?: string;
  sourceFilename?: string;
}) {
  const parsedData = data || (rawContent ? parseMeetingNotesData(rawContent) : null);

  if (!parsedData) {
    // Fallback if plain text was provided
    return (
      <div className="w-full max-w-3xl space-y-4 text-left">
        <DocumentMetaHeader
          docTitle="Meeting Notes"
          filename={sourceFilename || "source_document.pdf"}
          transformationLabel="Meeting Notes"
          creator={creatorName}
        />
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 text-left shadow-card space-y-4">
          <div className="prose text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {rawContent}
          </div>
        </div>
      </div>
    );
  }

  const title = parsedData.title || "Official Meeting Notes";
  const meetingDate = parsedData.meeting_date || "Not specified in source document.";
  const meetingTime = parsedData.meeting_time || "Not specified in source document.";
  const author = parsedData.created_by || creatorName || "Authenticated User";
  const source = parsedData.source_filename || sourceFilename || "source_document.pdf";
  const createdAtStr = parsedData.created_at || new Date().toISOString();
  const updatedAtStr = (parsedData as any).updated_at;

  return (
    <div className="w-full max-w-3xl space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={title}
        filename={source}
        transformationLabel="Meeting Notes"
        creator={author}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />

      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 space-y-6 text-left shadow-card overflow-hidden transition-all">
        {/* Meeting Details Panel (Requirement 19) */}
        <div>
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider mb-2">Meeting Details (From Source Document)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-line bg-s2/60 p-4 text-xs font-medium">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-brand shrink-0" />
              <div>
                <span className="text-mute block text-[10.5px]">Meeting Date:</span>
                <span className={cn("font-bold", meetingDate.includes("Not specified") ? "text-soft italic" : "text-ink")}>
                  {meetingDate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-brand shrink-0" />
              <div>
                <span className="text-mute block text-[10.5px]">Meeting Time:</span>
                <span className={cn("font-bold", meetingTime.includes("Not specified") ? "text-soft italic" : "text-ink")}>
                  {meetingTime}
                </span>
              </div>
            </div>
          </div>
        </div>



        {/* 1. Meeting Overview */}
        {parsedData.overview && (
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" /> Meeting Overview
            </h3>
            <p className="text-xs sm:text-sm text-ink/90 leading-relaxed bg-surface p-4 rounded-xl border border-line/60">
              {parsedData.overview}
            </p>
          </div>
        )}

        {/* 2. Agenda */}
        {parsedData.agenda && parsedData.agenda.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-brand" /> Agenda Items
            </h3>
            <ol className="space-y-1.5 text-xs sm:text-sm text-ink pl-1">
              {parsedData.agenda.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-bold text-brand shrink-0">{idx + 1}.</span>
                  <span>{item.replace(/^\d+[\.\)]\s*/, "")}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 3. Discussion Points */}
        {parsedData.discussion_points && parsedData.discussion_points.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Key Discussion Points
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-ink pl-1">
              {parsedData.discussion_points.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                  <span>{pt.replace(/^[•\-\*]\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 4. Decisions */}
        {parsedData.decisions && parsedData.decisions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Decisions Agreed
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-ink pl-1">
              {parsedData.decisions.map((dec, idx) => (
                <li key={idx} className="flex items-start gap-2.5 rounded-lg bg-emerald-50/60 p-2.5 border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span className="font-semibold text-emerald-950">{dec.replace(/^[•\-\*]\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 5. Action Items Table */}
        {parsedData.action_items && parsedData.action_items.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <Table className="h-4 w-4 text-brand" /> Action Items Register
            </h3>
            <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-s2/80 text-mute uppercase font-extrabold text-[10px] tracking-wider border-b border-line">
                  <tr>
                    <th className="p-3">Task Description</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsedData.action_items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-s2/40 transition">
                      <td className="p-3 font-semibold text-ink">{item.task}</td>
                      <td className="p-3 text-mute font-medium">{item.owner || "Unassigned"}</td>
                      <td className="p-3 text-mute font-medium">{item.due_date || "TBD"}</td>
                      <td className="p-3 text-right">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                            item.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "in_progress"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {item.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. Next Steps */}
        {parsedData.next_steps && parsedData.next_steps.length > 0 && (
          <div className="space-y-2 border-t border-line/60 pt-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-brand" /> Next Steps & Immediate Actions
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-ink pl-1">
              {parsedData.next_steps.map((ns, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <ArrowRight className="h-3.5 w-3.5 text-brand mt-0.5 shrink-0" />
                  <span>{ns.replace(/^[•\-\*]\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
