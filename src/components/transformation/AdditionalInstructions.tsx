import { useState, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, CornerDownLeft, Redo2, Sparkles, Undo2 } from "lucide-react";
import { Button } from "../ui";
import { cn } from "../../utils/cn";
import type { TransformationId } from "../../types";

export interface AdditionalInstructionsProps {
  transformationId: TransformationId | string;
  documentId: string;
  currentOutput: string;
  onApplyEdit: (instruction: string) => Promise<void>;
  loading?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  versionCount?: number;
  currentVersionIndex?: number;
  className?: string;
}

const PLACEHOLDERS: Record<string, string> = {
  summarize: "Make this more concise and highlight the most important findings.",
  "executive-brief": "Make the recommendations more prominent and shorten the background section.",
  executive_brief: "Make the recommendations more prominent and shorten the background section.",
  faq: "Add more questions about the implementation section.",
  email: "Make the email more formal and shorten the introduction.",
  "government-report": "Make the recommendations clearer and organize them into a table.",
  government_report: "Make the recommendations clearer and organize them into a table.",
  linkedin: "Make the opening stronger and keep the tone professional.",
  linkedin_post: "Make the opening stronger and keep the tone professional.",
  "linkedin-story": "Make this more engaging and simplify the language.",
  linkedin_story: "Make this more engaging and simplify the language.",
  twitter: "Make this sharper and keep it under 280 characters.",
  twitter_post: "Make this sharper and keep it under 280 characters.",
  presentation: "Make slide 3 shorter and turn the statistics into a table.",
  "meeting-notes": "Extract key decisions and emphasize action items.",
  meeting_notes: "Extract key decisions and emphasize action items.",
  "action-items": "Add missing tasks and prioritize by deadline.",
  action_items: "Add missing tasks and prioritize by deadline.",
  rewrite: "Simplify technical terms and improve readability.",
  extract: "Emphasize numeric metrics and policy impacts.",
  key_points: "Emphasize numeric metrics and policy impacts.",
};

const MAX_CHARS = 500;

export function AdditionalInstructions({
  transformationId,
  documentId: _documentId,
  currentOutput: _currentOutput,
  onApplyEdit,
  loading = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  versionCount = 1,
  currentVersionIndex = 0,
  className,
}: AdditionalInstructionsProps) {
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const normKey = String(transformationId || "summarize").toLowerCase();
  const placeholder =
    PLACEHOLDERS[normKey] ||
    "Tell ERA how you want to edit this transformation (e.g. shorten, change tone, emphasize key data)...";

  const remaining = MAX_CHARS - instruction.length;

  const handleSubmit = async () => {
    if (!instruction.trim() || loading) return;
    setError(null);
    setSuccess(false);

    try {
      await onApplyEdit(instruction.trim());
      setSuccess(true);
      setInstruction("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error("Edit transformation error:", err);
      setError(err?.message || "Could not apply instructions. Please check connection or try again.");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-card transition-all space-y-3 text-left",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandsoft text-brandink">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-ink tracking-tight">Additional Instructions</h3>
            <p className="text-[11.5px] text-mute">Tell ERA how you want to edit this transformation.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {versionCount > 1 && (
            <span className="rounded-md bg-s2 px-2 py-0.5 text-[11px] font-semibold text-mute">
              v{currentVersionIndex + 1} / {versionCount}
            </span>
          )}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo || loading}
              title="Undo last edit"
              aria-label="Undo last edit"
              className="flex items-center gap-1 rounded-lg border border-line bg-s2 px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-s3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo || loading}
              title="Redo edit"
              aria-label="Redo edit"
              className="flex items-center gap-1 rounded-lg border border-line bg-s2 px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-s3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </button>
          )}
          {success && (
            <span className="anim-fade flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5" /> Transformation updated
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={3}
          aria-label="Additional Instructions"
          className="focus-ring w-full resize-y rounded-xl border border-line bg-s2/60 p-3.5 text-[13px] leading-relaxed text-ink placeholder:text-soft focus:border-brand disabled:opacity-60"
        />
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-soft">
          <span className="hidden sm:inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> Press <kbd className="rounded bg-s2 px-1 font-mono">Cmd + Enter</kbd> to apply
          </span>
          <span className={cn("ml-auto font-mono", remaining < 50 && "text-warning font-bold", remaining === 0 && "text-danger font-bold")}>
            {remaining} characters remaining
          </span>
        </div>
      </div>

      {error && (
        <div className="anim-fade flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Edit failed</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          loading={loading}
          disabled={!instruction.trim() || loading}
          onClick={handleSubmit}
          icon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}
        >
          {loading ? "Editing transformation…" : "Apply Changes"}
        </Button>
      </div>
    </div>
  );
}

export default AdditionalInstructions;
