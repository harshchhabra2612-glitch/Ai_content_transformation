import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, FolderOpen, RefreshCw } from "lucide-react";
import { Button, Card, FileGlyph } from "./ui";
import { EraLogo } from "./branding/EraLogo";
import type { FileKind } from "../types";

export type UploadProcessingStatus = "IDLE" | "UPLOADING" | "PROCESSING" | "READY" | "ERROR";

export interface ProcessingFileMeta {
  name: string;
  kind: FileKind;
  size: number;
  document_id?: string;
}

interface DocumentProcessingModalProps {
  status: UploadProcessingStatus;
  file: ProcessingFileMeta | null;
  error?: string | null;
  onChooseTransformation: () => void;
  onOpenWorkspace: () => void;
  onRetry: () => void;
  onClose?: () => void;
}

export default function DocumentProcessingModal({
  status,
  file,
  error,
  onChooseTransformation,
  onOpenWorkspace,
  onRetry,
}: DocumentProcessingModalProps) {
  const [stageIndex, setStageIndex] = useState(0);

  const stages = [
    "Uploading document...",
    "Extracting content",
    "Creating document context",
    "Preparing workspace",
  ];

  useEffect(() => {
    if (status === "UPLOADING") {
      setStageIndex(0);
    } else if (status === "PROCESSING") {
      setStageIndex(1);
      const t1 = setTimeout(() => setStageIndex(2), 700);
      const t2 = setTimeout(() => setStageIndex(3), 1400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (status === "READY") {
      setStageIndex(3);
    }
  }, [status]);

  if (status === "IDLE" || !file) {
    return null;
  }

  const progressPercent =
    status === "UPLOADING"
      ? 25
      : status === "PROCESSING"
      ? stageIndex === 1
        ? 50
        : stageIndex === 2
        ? 75
        : 90
      : status === "READY"
      ? 100
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 anim-fade-in">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl text-center space-y-6 border-line relative overflow-hidden bg-surface">
        {/* Top Header Badge */}
        <div className="flex items-center justify-center gap-2">
          <EraLogo variant="mark" size="xs" />
          <span className="text-xs font-semibold text-mute tracking-wider uppercase">
            Document Processing
          </span>
        </div>

        {/* File Information Header */}
        <div className="flex items-center justify-center gap-3.5 bg-s2/70 p-3.5 rounded-2xl border border-line text-left">
          <FileGlyph kind={file.kind} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink truncate text-sm">{file.name}</p>
            <p className="text-[11px] font-medium text-mute uppercase tracking-wide">
              {file.kind} Document
            </p>
          </div>
        </div>

        {/* STATUS 1 & 2: UPLOADING / PROCESSING */}
        {(status === "UPLOADING" || status === "PROCESSING") && (
          <div className="space-y-5 py-2">
            <div className="relative flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-brandsoft flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-brand animate-spin" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-ink">Processing your document...</h3>
              <p className="mt-1 text-xs text-mute font-medium">Please wait while ERA indexes document context.</p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-2 w-full bg-s2 rounded-full overflow-hidden border border-line">
                <div
                  className="h-full bg-brand transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Processing Steps List */}
            <div className="space-y-2 text-left bg-surface/50 p-4 rounded-xl border border-line text-xs font-medium">
              {stages.slice(1).map((stageText, idx) => {
                const stepNum = idx + 1;
                const isDone = stageIndex > stepNum;
                const isCurrent = stageIndex === stepNum && status === "PROCESSING";

                return (
                  <div key={stageText} className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 text-brand animate-spin shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-line shrink-0" />
                    )}
                    <span
                      className={
                        isDone
                          ? "text-ink font-semibold"
                          : isCurrent
                          ? "text-brand font-bold"
                          : "text-mute"
                      }
                    >
                      {stageText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STATUS 3: READY */}
        {status === "READY" && (
          <div className="space-y-5 py-2 anim-slide-up">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-ink">Document Ready</h3>
              <p className="mt-1 text-xs text-mute font-medium">
                Your document has been processed successfully. Choose how you would like to proceed.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                className="flex-1 py-2.5 justify-center"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={onChooseTransformation}
              >
                Choose Transformation
              </Button>
              <Button
                variant="secondary"
                className="flex-1 py-2.5 justify-center"
                icon={<FolderOpen className="h-4 w-4" />}
                onClick={onOpenWorkspace}
              >
                Open Workspace
              </Button>
            </div>
          </div>
        )}

        {/* STATUS 4: ERROR */}
        {status === "ERROR" && (
          <div className="space-y-5 py-2 anim-slide-up">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
              <AlertCircle className="h-9 w-9 text-rose-500" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-ink">Document processing failed</h3>
              <p className="mt-1 text-xs text-rose-500 font-medium">
                {error || "An unexpected error occurred while parsing the document."}
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full justify-center"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={onRetry}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
