import { useState, useEffect, useRef } from "react";
import { AlertCircle, Film, Loader2, RefreshCw, Video, Copy, Check, Send, Sparkles } from "lucide-react";
import { Button } from "../ui";
import { cn } from "../../utils/cn";
import { generateGeminiVideo, getVideoStatus } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { formatMediaTimestamp } from "../../utils/date";

export interface VideoGenerationPanelProps {
  documentId?: string;
  initialPrompt?: string;
  onVideoGenerated?: (result: any) => void;
  className?: string;
}

export interface GeminiVideoErrorState {
  code: string;
  message: string;
  retryable: boolean;
  retry_after_seconds?: number;
}

export type VideoUIStatus = 
  | "idle"
  | "submitting"
  | "generating"
  | "processing"
  | "completed"
  | "rate_limited"
  | "quota_exhausted"
  | "failed";

const UNIVERSAL_VIDEO_PROMPT =
  "Create a professional 10-second 16:9 cinematic video based strictly on the uploaded document, visually communicating its main subject, key concepts, important information, and relevant details. Use polished composition, natural motion, professional lighting, smooth camera movement, and a clear visual narrative. Do not introduce information that is not supported by the document.";

export function VideoGenerationPanel({
  documentId,
  initialPrompt = "",
  onVideoGenerated,
  className,
}: VideoGenerationPanelProps) {
  const toast = useToast();
  const { user } = useAuth();

  const defaultPrompt = initialPrompt.trim() || UNIVERSAL_VIDEO_PROMPT;
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [askForChangesInput, setAskForChangesInput] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("10 seconds");
  
  const [status, setStatus] = useState<VideoUIStatus>("idle");
  const [errorState, setErrorState] = useState<GeminiVideoErrorState | null>(null);
  const [videoResult, setVideoResult] = useState<any | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeOpId, setActiveOpId] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(10);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Poll active video operation status if in processing state (40-50s flow)
  useEffect(() => {
    if (!activeOpId || status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await getVideoStatus(activeOpId);
        if (statusRes.progress_percent !== undefined) {
          setProgressPercent(statusRes.progress_percent);
        }
        if (statusRes.status === "completed") {
          setVideoResult(statusRes);
          setVideoLoadError(false);
          setStatus("completed");
          setActiveOpId(null);
          toast.success("Video Ready", "Gemini Veo engine created your video asset.");
          if (onVideoGenerated) onVideoGenerated(statusRes);
        } else if (!statusRes.success) {
          const errObj = statusRes.error || {
            code: "GEMINI_UNKNOWN_ERROR",
            message: "Video generation failed.",
            retryable: false,
          };
          setErrorState(errObj);
          setStatus(errObj.code === "GEMINI_RATE_LIMIT" ? "rate_limited" : (errObj.code === "GEMINI_QUOTA_EXHAUSTED" ? "quota_exhausted" : "failed"));
          setActiveOpId(null);
        }
      } catch (e) {
        console.warn("[VIDEO POLL ERROR]", e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeOpId, status, onVideoGenerated, toast]);

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = (customPrompt || prompt).trim();
    if (!activePrompt || status === "submitting" || status === "generating" || status === "processing") return;
    
    setStatus("submitting");
    setErrorState(null);
    setVideoResult(null);
    setVideoLoadError(false);
    setProgressPercent(10);

    try {
      setStatus("generating");
      const response = await generateGeminiVideo({
        prompt: activePrompt,
        document_id: documentId,
        options: {
          aspect_ratio: aspectRatio,
          duration: duration,
          style: "Cinematic",
        },
      });

      if (response.success) {
        if (response.status === "processing" && response.operation_id) {
          setStatus("processing");
          setActiveOpId(response.operation_id);
          toast.info("Generating Video...", "Processing video motion frames...");
        } else if (response.status === "completed") {
          setVideoResult(response);
          setVideoLoadError(false);
          setStatus("completed");
          toast.success("Video Ready", "Gemini Veo engine created your video asset.");
          if (onVideoGenerated) {
            onVideoGenerated(response);
          }
        }
      } else {
        const errObj = response.error || {
          code: "GEMINI_UNKNOWN_ERROR",
          message: response.detail || "Video generation failed.",
          retryable: false,
        };
        setErrorState(errObj);
        if (errObj.code === "GEMINI_RATE_LIMIT") setStatus("rate_limited");
        else if (errObj.code === "GEMINI_QUOTA_EXHAUSTED") setStatus("quota_exhausted");
        else setStatus("failed");
        toast.error("Video Generation Failed", errObj.message);
      }
    } catch (err: any) {
      console.error("Gemini Video Generation Error:", err);
      const errObj: GeminiVideoErrorState = err?.detail?.error || {
        code: "GEMINI_UNKNOWN_ERROR",
        message: err?.detail || err?.message || "Gemini Video generation failed. Please try again.",
        retryable: true,
      };
      setErrorState(errObj);
      if (errObj.code === "GEMINI_RATE_LIMIT") setStatus("rate_limited");
      else if (errObj.code === "GEMINI_QUOTA_EXHAUSTED") setStatus("quota_exhausted");
      else setStatus("failed");
      toast.error("Video Generation Failed", errObj.message);
    }
  };

  const handleApplyChanges = () => {
    if (!askForChangesInput.trim() || isLoading) return;
    const newInstruction = askForChangesInput.trim();
    setAskForChangesInput("");
    handleGenerate(newInstruction);
  };

  const copyPrompt = async () => {
    const textToCopy = videoResult?.prompt_used || prompt;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Copied", "Video prompt copied to clipboard.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Copy failed", "Could not access clipboard.");
    }
  };

  const getVideoMediaSrc = () => {
    const rawUrl = videoResult?.video_url || videoResult?.media_url || "";
    if (!rawUrl) return "";
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
    return `http://localhost:8000${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  };

  // Requirement 14: Processing states mapping for video
  const getProcessingStageText = () => {
    if (progressPercent < 25) return "Generating Video...";
    if (progressPercent < 50) return "Preparing video...";
    if (progressPercent < 75) return "Rendering motion...";
    return "Finalizing video...";
  };

  const getBadgeState = () => {
    switch (status) {
      case "submitting":
      case "generating":
        return { label: "Generating Video...", color: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30" };
      case "processing":
        return { label: getProcessingStageText(), color: "bg-purple-500/15 text-purple-600 border-purple-500/30 font-semibold" };
      case "completed":
        return { label: "Video Ready", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-semibold" };
      case "rate_limited":
        return { label: "Rate limited", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
      case "quota_exhausted":
        return { label: "Quota exhausted", color: "bg-rose-500/15 text-rose-600 border-rose-500/30" };
      case "failed":
        return { label: "Failed", color: "bg-red-500/15 text-red-600 border-red-500/30" };
      default:
        return { label: "Gemini Veo", color: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30" };
    }
  };

  const badge = getBadgeState();
  const isLoading = status === "submitting" || status === "generating" || status === "processing";

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5 shadow-card transition-all space-y-4 text-left",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-md">
            <Film className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight text-ink">Generate Video</h3>
            <p className="text-[11.5px] text-mute">Gemini Veo Motion Engine</p>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold border transition-all", badge.color)}>
          {badge.label}
        </span>
      </div>

      {/* Universal Prompt textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-bold text-ink">Video Generation Prompt</label>
          <button
            type="button"
            onClick={() => setPrompt(UNIVERSAL_VIDEO_PROMPT)}
            className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="h-3 w-3" /> Reset Universal Prompt
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Create a professional 10-second 16:9 cinematic video based strictly on the uploaded document..."
          rows={3}
          disabled={isLoading}
          className="focus-ring w-full resize-y rounded-xl border border-line bg-s2/60 p-3 text-[13px] leading-relaxed text-ink placeholder:text-soft focus:border-brand disabled:opacity-60"
        />
      </div>

      {/* Options Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-mute uppercase tracking-wider">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            disabled={isLoading}
            className="focus-ring mt-1 w-full rounded-xl border border-line bg-s2 px-3 py-2 text-xs font-semibold text-ink focus:border-brand disabled:opacity-60"
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Vertical Video)</option>
            <option value="1:1">1:1 (Square)</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-mute uppercase tracking-wider">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={isLoading}
            className="focus-ring mt-1 w-full rounded-xl border border-line bg-s2 px-3 py-2 text-xs font-semibold text-ink focus:border-brand disabled:opacity-60"
          >
            <option value="10 seconds">10 Seconds</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {errorState && (
        <div className="anim-fade flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold text-[13px]">
              {status === "rate_limited" && "Rate limited"}
              {status === "quota_exhausted" && "Quota exhausted"}
              {status === "failed" && "Failed"}
            </p>
            <p className="mt-1 leading-relaxed text-mute dark:text-amber-200">
              {errorState.message || "Gemini Video generation encountered an error. Please try again."}
            </p>
          </div>
        </div>
      )}

      {/* Processing State Indicator (REQUIREMENT 4, 14: 40-50 seconds flow) */}
      {isLoading && (
        <div className="anim-fade space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-4 text-white">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
            <span className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" /> {getProcessingStageText()}
            </span>
            <span className="font-mono text-[11px] text-indigo-300 font-bold">
              {progressPercent}%
            </span>
          </div>

          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-indigo-800/60 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Film className="h-7 w-7 text-indigo-400 animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{getProcessingStageText()}</p>
              <p className="mt-1 text-[11px] text-slate-400 max-w-sm">
                Gemini Veo engine rendering video motion sequence based strictly on source document...
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-xs h-2 bg-slate-800 rounded-full overflow-hidden border border-indigo-500/20 mt-2">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* EXISTING VIDEO RESULT PLAYER & METADATA SECTION (REQUIREMENTS 5, 6, 7, 8, 10) */}
      {status === "completed" && videoResult && (
        <div className="anim-fade space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-4 text-white">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Video className="h-4 w-4 text-emerald-400" /> Video Result
            </span>
            <span className="font-mono text-[10.5px] text-indigo-300">
              ID: {videoResult.generation_id || "gen_vid_active"}
            </span>
          </div>

          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-indigo-800 bg-slate-950 flex flex-col items-center justify-center p-1 text-center">
            {videoLoadError ? (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-rose-400" />
                <p className="text-xs font-extrabold text-white">Unable to load generated video.</p>
                <button
                  onClick={() => {
                    setVideoLoadError(false);
                    if (videoRef.current) videoRef.current.load();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Video Load
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={getVideoMediaSrc()}
                controls
                autoPlay
                onError={(e) => {
                  console.error("[VIDEO LOAD ERROR] Failed to play video src:", getVideoMediaSrc(), e);
                  setVideoLoadError(true);
                }}
                className="w-full h-full object-contain rounded-md"
              />
            )}
          </div>

          {/* MEDIA METADATA SECTION FOR VIDEO (REQUIREMENT 5, 6, 7, 8, 10) */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-900/30 p-3.5 space-y-2 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10.5px] block">Created</span>
                <span className="font-mono text-white text-[12px] mt-0.5 block font-semibold">
                  {formatMediaTimestamp(videoResult.created_at)}
                </span>
              </div>
              <div>
                <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10.5px] block">Created By</span>
                <span className="text-white text-[12px] mt-0.5 block font-semibold truncate">
                  {videoResult.created_by?.name || user?.name || user?.email || "Current User"}
                </span>
              </div>
              <div>
                <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10.5px] block">Source Document</span>
                <span className="text-white text-[12px] mt-0.5 block font-semibold truncate" title={videoResult.source_document?.filename}>
                  {videoResult.source_document?.filename || "AI_Test_Document.pdf"}
                </span>
              </div>
              <div>
                <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10.5px] block">Duration</span>
                <span className="text-white text-[12px] mt-0.5 block font-semibold">
                  {videoResult.duration || 10} Seconds
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              onClick={copyPrompt}
              className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-900/40 px-2.5 py-1.5 text-[11px] font-bold text-indigo-200 transition hover:bg-indigo-900/60 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Prompt"}
            </button>
            <span className="text-[11px] font-mono text-indigo-300">
              10 Seconds · {aspectRatio}
            </span>
          </div>

          {/* ASK FOR CHANGES / ADDITIONAL INSTRUCTIONS (REQUIREMENT 12) */}
          <div className="pt-3 border-t border-indigo-500/20 space-y-2">
            <label className="text-[11.5px] font-bold text-indigo-200 block">Ask for Changes / Additional Instructions</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={askForChangesInput}
                onChange={(e) => setAskForChangesInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyChanges()}
                placeholder="Enter changes to trigger a new video generation cycle..."
                className="focus-ring flex-1 rounded-xl border border-indigo-500/30 bg-indigo-950/80 px-3 py-2 text-xs font-medium text-white placeholder:text-indigo-400 focus:border-indigo-400"
                disabled={isLoading}
              />
              <Button
                variant="primary"
                loading={isLoading}
                disabled={!askForChangesInput.trim() || isLoading}
                onClick={handleApplyChanges}
                icon={<Send className="h-3.5 w-3.5" />}
              >
                Apply Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Action Button */}
      <div className="flex items-center justify-end pt-1">
        <Button
          variant="primary"
          loading={isLoading}
          disabled={!prompt.trim() || isLoading}
          onClick={() => handleGenerate()}
          icon={!isLoading ? (videoResult ? <RefreshCw className="h-4 w-4" /> : <Film className="h-4 w-4" />) : undefined}
          className="w-full sm:w-auto"
        >
          {isLoading
            ? "Processing Video..."
            : status === "completed"
            ? "Regenerate Video"
            : "Generate Video"}
        </Button>
      </div>
    </div>
  );
}

export default VideoGenerationPanel;
