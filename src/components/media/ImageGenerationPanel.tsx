import { useState, useEffect, useRef } from "react";
import { AlertCircle, Camera, Check, Copy, Download, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Send } from "lucide-react";
import { Button } from "../ui";
import { cn } from "../../utils/cn";
import { generateGeminiImage, resolveMediaUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { formatMediaTimestamp } from "../../utils/date";

export interface ImageGenerationPanelProps {
  documentId?: string;
  initialPrompt?: string;
  onImageGenerated?: (imageUrl: string, prompt: string, metadata: any) => void;
  className?: string;
}

export interface GeminiErrorState {
  code: string;
  message: string;
  retryable: boolean;
  retry_after_seconds?: number;
}

const UNIVERSAL_IMAGE_PROMPT =
  "Create a professional 16:9 visual based strictly on the uploaded document, highlighting its main subject, key information, important concepts, and relevant details. Use a clean, polished, visually engaging composition with realistic lighting, strong hierarchy, and an appropriate professional style. Do not introduce information that is not supported by the document.";

export function ImageGenerationPanel({
  documentId,
  initialPrompt = "",
  onImageGenerated,
  className,
}: ImageGenerationPanelProps) {
  const toast = useToast();
  const { user } = useAuth();
  
  const cleanedInitial =
    !initialPrompt ||
    initialPrompt.includes("Visual Prompt Specification") ||
    initialPrompt.includes("### Visual Prompt") ||
    initialPrompt.includes("4K photorealistic")
      ? UNIVERSAL_IMAGE_PROMPT
      : initialPrompt.trim();
  const [prompt, setPrompt] = useState(cleanedInitial);
  const [askForChangesInput, setAskForChangesInput] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [style, setStyle] = useState("Professional");
  
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState("Generating Image...");
  const [progressPercent, setProgressPercent] = useState(0);
  
  const [errorState, setErrorState] = useState<GeminiErrorState | null>(null);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startProcessingTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgressPercent(2);
    setProcessingStage("Generating Image...");

    const startTime = Date.now();
    const targetMs = 20000; // 20 seconds flow

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(96, Math.floor((elapsed / targetMs) * 100));
      setProgressPercent(pct);

      if (elapsed < 5000) {
        setProcessingStage("Generating Image...");
      } else if (elapsed < 10000) {
        setProcessingStage("Processing your visual...");
      } else if (elapsed < 15000) {
        setProcessingStage("Refining visual details...");
      } else {
        setProcessingStage("Finalizing image...");
      }
    }, 400);
  };

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = (customPrompt || prompt).trim();
    if (!activePrompt || loading) return;

    setLoading(true);
    setErrorState(null);
    setGeneratedResult(null); // REQUIREMENT 1: Must NOT show old image or reveal asset during processing
    startProcessingTimer();

    try {
      const response = await generateGeminiImage({
        prompt: activePrompt,
        document_id: documentId,
        options: {
          aspect_ratio: aspectRatio,
          style: style,
          quality: "High Resolution",
        },
      });

      if (timerRef.current) clearInterval(timerRef.current);

      if (response.success && (response.image_url || response.media_url)) {
        setProcessingStage("Image Ready");
        setProgressPercent(100);
        setGeneratedResult(response);
        toast.success("Image Ready", "Visual asset generated successfully.");
        if (onImageGenerated) {
          onImageGenerated(response.image_url || response.media_url, response.prompt_used || activePrompt, response);
        }
      } else {
        const errObj = response.error || {
          code: "GEMINI_UNKNOWN_ERROR",
          message: response.detail || "Image generation failed.",
          retryable: false,
        };
        setErrorState(errObj);
        toast.error("Generation Failed", errObj.message);
      }
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      console.error("Gemini Image Generation Error:", err);
      const errObj: GeminiErrorState = err?.detail?.error || {
        code: "GEMINI_UNKNOWN_ERROR",
        message: err?.detail || err?.message || "Gemini generation failed. Please try again.",
        retryable: true,
      };
      setErrorState(errObj);
      toast.error("Generation Failed", errObj.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = () => {
    if (!askForChangesInput.trim() || loading) return;
    const newInstruction = askForChangesInput.trim();
    setAskForChangesInput("");
    handleGenerate(newInstruction);
  };

  const copyPrompt = async () => {
    const textToCopy = generatedResult?.prompt_used || prompt;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Copied", "Visual prompt copied to clipboard.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Copy failed", "Could not access clipboard.");
    }
  };

  const downloadImage = () => {
    const imgUrl = generatedResult?.media_url || generatedResult?.image_url;
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `ERA-Image-${Date.now()}.jpg`;
    a.click();
    toast.success("Download started", "Generated image download initiated.");
  };

  const getBadgeState = () => {
    if (loading) return { label: processingStage, color: "bg-blue-500/15 text-blue-600 border-blue-500/30" };
    if (generatedResult) return { label: "Image Ready", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-semibold" };
    if (errorState) {
      switch (errorState.code) {
        case "GEMINI_RATE_LIMIT":
          return { label: "Rate limited", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
        case "GEMINI_QUOTA_EXHAUSTED":
          return { label: "Quota exhausted", color: "bg-rose-500/15 text-rose-600 border-rose-500/30" };
        default:
          return { label: "Generation failed", color: "bg-slate-500/15 text-slate-600 border-slate-500/30" };
      }
    }
    return { label: "Gemini AI", color: "bg-brandsoft text-brandink border-brand/20" };
  };

  const badge = getBadgeState();
  const rawSrc = generatedResult?.media_url || generatedResult?.image_url;
  const currentImageSrc = resolveMediaUrl(rawSrc);

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
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight text-ink">Generate Image</h3>
            <p className="text-[11.5px] text-mute">Gemini Visual Media Engine</p>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold border transition-all", badge.color)}>
          {badge.label}
        </span>
      </div>

      {/* Universal Prompt textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-bold text-ink">Image Generation Prompt</label>
          <button
            type="button"
            onClick={() => setPrompt(UNIVERSAL_IMAGE_PROMPT)}
            className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="h-3 w-3" /> Reset Universal Prompt
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Create a professional 16:9 visual based strictly on the uploaded document..."
          rows={3}
          disabled={loading}
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
            disabled={loading}
            className="focus-ring mt-1 w-full rounded-xl border border-line bg-s2 px-3 py-2 text-xs font-semibold text-ink focus:border-brand disabled:opacity-60"
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="9:16">9:16 (Vertical Story)</option>
            <option value="4:3">4:3 (Standard)</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-mute uppercase tracking-wider">Style</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={loading}
            className="focus-ring mt-1 w-full rounded-xl border border-line bg-s2 px-3 py-2 text-xs font-semibold text-ink focus:border-brand disabled:opacity-60"
          >
            <option value="Professional">Professional</option>
            <option value="Photorealistic">Photorealistic 4K</option>
            <option value="Cinematic">Cinematic Lighting</option>
            <option value="Minimalist">Minimalist / Clean</option>
            <option value="Infographic">Infographic Illustration</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {errorState && (
        <div className="anim-fade flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold text-[13px]">
              {errorState.code === "GEMINI_RATE_LIMIT" && "Rate limited"}
              {errorState.code === "GEMINI_QUOTA_EXHAUSTED" && "Quota exhausted"}
              {(!errorState.code || errorState.code === "GEMINI_UNKNOWN_ERROR") && "Generation failed"}
            </p>
            <p className="mt-1 leading-relaxed text-mute dark:text-amber-200">
              {errorState.message || "Gemini image generation encountered an error. Please try again."}
            </p>
          </div>
        </div>
      )}

      {/* 20-SECOND PROCESSING STATE INDICATOR (REQUIREMENT 1, 14) */}
      {loading && (
        <div className="anim-fade space-y-3 rounded-xl border border-blue-500/30 bg-blue-950/40 p-4 text-white">
          <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
            <span className="flex items-center gap-2 text-xs font-bold text-blue-300">
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" /> {processingStage}
            </span>
            <span className="font-mono text-[11px] text-blue-300 font-bold">
              {progressPercent}%
            </span>
          </div>

          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-blue-800/60 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <ImageIcon className="h-7 w-7 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{processingStage}</p>
              <p className="mt-1 text-[11px] text-slate-400 max-w-sm">
                Creating enterprise visual asset based strictly on source document...
              </p>
            </div>
            {/* Smooth 20-second progress bar */}
            <div className="w-full max-w-xs h-2 bg-slate-800 rounded-full overflow-hidden border border-blue-500/20 mt-2">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* EXISTING IMAGE RESULT AREA & MEDIA METADATA (REQUIREMENTS 5, 6, 7, 8, 10) */}
      {!loading && generatedResult && currentImageSrc && (
        <div className="anim-fade space-y-3 rounded-xl border border-line bg-s2/40 p-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-brand" /> Image Result
            </span>
            <span className="font-mono text-[10.5px] text-mute">
              ID: {generatedResult.generation_id || "gen_img_active"}
            </span>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-line bg-black">
            <img
              src={currentImageSrc}
              alt="Generated Visual"
              className="w-full object-contain max-h-[380px]"
            />
          </div>

          {/* MEDIA METADATA SECTION (REQUIREMENT 5, 6, 7, 8, 10) */}
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="font-bold text-mute uppercase tracking-wider text-[10.5px] block">Created</span>
                <span className="font-mono text-ink text-[12px] mt-0.5 block font-semibold">
                  {formatMediaTimestamp(generatedResult.created_at)}
                </span>
              </div>
              <div>
                <span className="font-bold text-mute uppercase tracking-wider text-[10.5px] block">Created By</span>
                <span className="text-ink text-[12px] mt-0.5 block font-semibold truncate">
                  {generatedResult.created_by?.name || user?.name || user?.email || "Current User"}
                </span>
              </div>
              <div>
                <span className="font-bold text-mute uppercase tracking-wider text-[10.5px] block">Source Document</span>
                <span className="text-ink text-[12px] mt-0.5 block font-semibold truncate" title={generatedResult.source_document?.filename}>
                  {generatedResult.source_document?.filename || "AI_Test_Document.pdf"}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              onClick={copyPrompt}
              className="flex items-center gap-1 rounded-lg border border-line bg-s2 px-2.5 py-1.5 text-[11px] font-bold text-ink transition hover:bg-s3 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Prompt"}
            </button>
            <button
              onClick={downloadImage}
              className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download Image
            </button>
          </div>

          {/* ASK FOR CHANGES / ADDITIONAL INSTRUCTIONS (REQUIREMENT 3, 12) */}
          <div className="pt-3 border-t border-line space-y-2">
            <label className="text-[11.5px] font-bold text-ink block">Ask for Changes / Additional Instructions</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={askForChangesInput}
                onChange={(e) => setAskForChangesInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyChanges()}
                placeholder="Enter changes to trigger a new 20-second generation cycle..."
                className="focus-ring flex-1 rounded-xl border border-line bg-s2 px-3 py-2 text-xs font-medium text-ink placeholder:text-soft focus:border-brand"
                disabled={loading}
              />
              <Button
                variant="primary"
                loading={loading}
                disabled={!askForChangesInput.trim() || loading}
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
          loading={loading}
          disabled={!prompt.trim() || loading}
          onClick={() => handleGenerate()}
          icon={!loading ? (generatedResult ? <RefreshCw className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />) : undefined}
          className="w-full sm:w-auto"
        >
          {loading
            ? "Processing..."
            : generatedResult
            ? "Regenerate Image"
            : "Generate Image"}
        </Button>
      </div>
    </div>
  );
}

export default ImageGenerationPanel;
