import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Download, Eye, FileDown, Link2, RefreshCw, Share2, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import WorkspaceStepper from "../components/WorkspaceStepper";
import { PlatformPreview, SOCIAL_WORKS } from "../components/previews";
import { AUDIENCES, LENGTHS, tonesFor } from "../data/mock";
import { contentToPlain } from "../services/ai";
import { editTransformation, sendChatMessage, getAiConfig, type AiConfig, type AiMetrics } from "../services/api";
import { AiTeamDisplay } from "../components/AiTeamDisplay";
import { Badge, Button, Card, EmptyState, IconButton, Modal, TRANS_META, TransformationGlyph, badgeTone } from "../components/ui";
import { cn } from "../utils/cn";
import type { GeneratedResult, TransformationId } from "../types";
import AdditionalInstructions from "../components/transformation/AdditionalInstructions";

const LABEL_OF: Record<string, string> = {
  professional: "Professional",
  formal: "Formal",
  concise: "Concise",
  executive: "Executive",
  informative: "Informative",
  leadership: "Leadership",
  "public-announcement": "Public Announcement",
  announcement: "Announcement",
  "public-update": "Public Update",
  "professional-story": "Professional Story",
  "impact-story": "Impact Story",
  "leadership-story": "Leadership Story",
  "public-service-story": "Public Service Story",
  "project-story": "Project Story",
};

const UNIVERSAL_IMAGE_PROMPT =
  "Create a professional 16:9 visual based strictly on the uploaded document, highlighting its main subject, key information, important concepts, and relevant details. Use a clean, polished, visually engaging composition with realistic lighting, strong hierarchy, and an appropriate professional style. Do not introduce information that is not supported by the document.";

const UNIVERSAL_VIDEO_PROMPT =
  "Create a professional 10-second 16:9 cinematic video based strictly on the uploaded document, visually communicating its main subject, key concepts, important information, and relevant details. Use polished composition, natural motion, professional lighting, smooth camera movement, and a clear visual narrative. Do not introduce information that is not supported by the document.";

export default function WorkspacePreview() {
  const { sessionFiles, selectedTransformation, setSelectedTransformation, wsConfig, generated, generatedResults, setGenerated, persistGeneratedOutput } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  
  const readyFiles = sessionFiles.filter((f) => f.status === "ready");
  const currentDocId = readyFiles[0]?.document_id || readyFiles[0]?.fileId || readyFiles[0]?.id;

  // Filter all generated results for current document
  const validResults = generatedResults.filter(
    (r) => !currentDocId || !r.document_id || r.document_id === currentDocId
  );

  // Active work prioritizes explicitly selected transformation
  const work = selectedTransformation || generated?.transformation || "summarize";
  const isMediaWork = (work as string).includes("photo") || (work as string).includes("video");

  // Ensure active result strictly belongs to current document AND current transformation
  const matchedResult = validResults.find((r) => r.transformation === work);

  const activeResult: GeneratedResult | null =
    generated &&
    (!currentDocId || !generated.document_id || generated.document_id === currentDocId) &&
    generated.transformation === work
      ? generated
      : matchedResult ?? null;

  const [content, setContent] = useState("");
  const [share, setShare] = useState(false);
  const [regen, setRegen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [historyStore, setHistoryStore] = useState<Record<string, { history: any[]; index: number }>>({});
  const runTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [activeMetrics, setActiveMetrics] = useState<AiMetrics | null>(null);
  const [cumulativeStats, setCumulativeStats] = useState(() => {
    try {
      const raw = sessionStorage.getItem("era_cumulative_ai_stats");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 };
  });

  useEffect(() => {
    getAiConfig()
      .then((cfg) => setAiConfig(cfg))
      .catch((err) => console.warn("Failed to fetch AI config:", err));
  }, []);

  useEffect(() => {
    if (activeResult?.usage) {
      setActiveMetrics({
        model: activeResult.model || "qwen-7b",
        temperature: activeResult.temperature ?? 0.2,
        max_tokens: activeResult.max_tokens ?? 1000,
        usage: activeResult.usage,
        latency_ms: activeResult.latency_ms ?? 0,
      });
    }
  }, [activeResult]);

  useEffect(() => {
    return () => runTimers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const wStr = work as string;
    if (wStr === "photo-generation" || wStr === "photo_generation") {
      const isClean = activeResult?.content &&
        !activeResult.content.includes("bullet points") &&
        !activeResult.content.includes("Visual Prompt Specification") &&
        !activeResult.content.includes("summarizing");
      setContent(isClean ? activeResult.content : UNIVERSAL_IMAGE_PROMPT);
    } else if (wStr === "video-generation" || wStr === "video_generation") {
      const isClean = activeResult?.content &&
        !activeResult.content.includes("30-second") &&
        !activeResult.content.includes("4-scene") &&
        !activeResult.content.includes("bullet points");
      setContent(isClean ? activeResult.content : UNIVERSAL_VIDEO_PROMPT);
    } else if (activeResult) {
      setContent(activeResult.content);
      setHistoryStore((prev) => {
        if (!prev[work]) {
          return {
            ...prev,
            [work]: { history: [activeResult.content], index: 0 },
          };
        }
        return prev;
      });
    }
  }, [activeResult?.id, activeResult?.transformation, activeResult?.document_id, work]);

  if (!work || (!activeResult && !isMediaWork)) {
    return (
      <div className="space-y-5">
        <WorkspaceStepper current="preview" />
        <Card>
          <EmptyState
            icon={<Eye className="h-6 w-6" />}
            title="Nothing to preview yet"
            description="Generate content in the configuration step to see the platform preview here."
            action={
              <Button variant="primary" onClick={() => navigate("/workspace/configure")}>
                <Sparkles className="h-4 w-4" /> Generate Content
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const meta = TRANS_META[work];
  const isSocial = SOCIAL_WORKS.includes(work as (typeof SOCIAL_WORKS)[number]);
  const toneLabel = LABEL_OF[wsConfig.tone] ?? tonesFor(work).find((t) => t.id === wsConfig.tone)?.label ?? wsConfig.tone;
  const lengthLabel = LENGTHS.find((l) => l.id === wsConfig.length)?.label ?? wsConfig.length;
  const audienceLabel = AUDIENCES.find((a) => a.id === wsConfig.audience)?.label ?? wsConfig.audience;

  const updateContent = (v: string) => {
    setContent(v);
    if (activeResult) {
      setGenerated({ ...activeResult, content: v });
    }
  };

  const copy = async () => {
    const text = contentToPlain(content);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(isSocial ? "Content copied" : "Content copied to clipboard", "Paste it anywhere to use.");
    } catch {
      toast.error("Could not copy", "Clipboard access was blocked.");
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([contentToPlain(content)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(readyFiles[0]?.name ?? "ERA-result").replace(/\.[^.]+$/, "")}-${meta.short.toLowerCase().replace(/[\s/]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started", "Text file saved.");
  };

  const downloadPdf = () => {
    toast.success("PDF export started", "A PDF version is being prepared.");
  };

  const downloadImage = () => {
    toast.success("Image export started", `${meta.label} preview saved as an image.`);
  };

  const doRegen = async () => {
    setRegen(true);
    toast.info("Generating alternative version…", "Please wait a moment.");
    try {
      const docId = activeResult?.document_id || readyFiles[0]?.id;
      const response = await sendChatMessage({
        document_id: docId,
        transformation: work as TransformationId,
        tone: wsConfig.tone,
        length: wsConfig.length,
        audience: wsConfig.audience,
      });
      const activeTitle = activeResult?.title || meta.label;
      const updatedResult: GeneratedResult = {
        id: Date.now().toString(36),
        document_id: docId,
        title: activeTitle,
        content: response.answer,
        transformation: work as TransformationId,
        createdAt: new Date().toISOString(),
        model: response.model || "qwen-7b",
        temperature: response.temperature ?? 0.2,
        max_tokens: response.max_tokens ?? 1000,
        usage: response.usage,
        latency_ms: response.latency_ms,
      };

      if (response.usage) {
        setActiveMetrics({
          model: response.model || "qwen-7b",
          temperature: response.temperature ?? 0.2,
          max_tokens: response.max_tokens ?? 1000,
          usage: response.usage,
          latency_ms: response.latency_ms ?? 0,
        });
        setCumulativeStats((prev: any) => {
          const u = response.usage;
          const next = {
            totalRequests: prev.totalRequests + 1,
            totalInputTokens: prev.totalInputTokens + (u.prompt_tokens || 0),
            totalOutputTokens: prev.totalOutputTokens + (u.completion_tokens || 0),
            totalTokens: prev.totalTokens + (u.total_tokens || 0),
          };
          try { sessionStorage.setItem("era_cumulative_ai_stats", JSON.stringify(next)); } catch {}
          return next;
        });
      }

      setGenerated(updatedResult);
      await persistGeneratedOutput({
        transformation: work as TransformationId,
        title: activeTitle,
        content: response.answer,
      });
      toast.success("Preview updated", "A new version of your content is ready and saved.");
    } catch (error) {
      console.error("Regenerate error:", error);
      toast.error("Regeneration failed", "Could not generate alternative version.");
    } finally {
      setRegen(false);
    }
  };

  const activeHistory = historyStore[work] || { history: [content], index: 0 };
  const canUndo = activeHistory.index > 0;
  const canRedo = activeHistory.index < activeHistory.history.length - 1;

  const handleApplyEdit = async (instruction: string) => {
    if (!activeResult) return;
    const docId = activeResult.document_id || currentDocId;
    if (!docId) {
      toast.error("Document reference missing", "Cannot edit transformation without a document context.");
      return;
    }

    setEditing(true);
    try {
      const currentRawContent = activeHistory.history[activeHistory.index] ?? content;
      const response = await editTransformation({
        document_id: docId,
        transformation_id: work,
        current_output: currentRawContent,
        instruction,
      });

      if (response.success && response.content) {
        const newOutput = response.content;
        const stringifiedContent = typeof newOutput === "string" ? newOutput : JSON.stringify(newOutput, null, 2);

        setHistoryStore((prev) => {
          const currentHist = prev[work] || { history: [content], index: 0 };
          const newHistory = [...currentHist.history.slice(0, currentHist.index + 1), newOutput];
          return {
            ...prev,
            [work]: { history: newHistory, index: newHistory.length - 1 },
          };
        });

        if (response.usage) {
          setActiveMetrics({
            model: response.model || "qwen-7b",
            temperature: response.temperature ?? 0.2,
            max_tokens: response.max_tokens ?? 1000,
            usage: response.usage,
            latency_ms: response.latency_ms ?? 0,
          });
          setCumulativeStats((prev: any) => {
            const u = response.usage;
            const next = {
              totalRequests: prev.totalRequests + 1,
              totalInputTokens: prev.totalInputTokens + (u.prompt_tokens || 0),
              totalOutputTokens: prev.totalOutputTokens + (u.completion_tokens || 0),
              totalTokens: prev.totalTokens + (u.total_tokens || 0),
            };
            try { sessionStorage.setItem("era_cumulative_ai_stats", JSON.stringify(next)); } catch {}
            return next;
          });
        }

        setContent(stringifiedContent);
        const updatedResult: GeneratedResult = {
          ...activeResult,
          content: stringifiedContent,
          updatedAt: new Date().toISOString(),
          model: response.model || activeResult.model,
          temperature: response.temperature ?? activeResult.temperature,
          max_tokens: response.max_tokens ?? activeResult.max_tokens,
          usage: response.usage || activeResult.usage,
          latency_ms: response.latency_ms ?? activeResult.latency_ms,
        };
        setGenerated(updatedResult);
        setGenerated(updatedResult);
        await persistGeneratedOutput({
          transformation: work as TransformationId,
          title: activeResult.title,
          content: stringifiedContent,
        });
        toast.success("Transformation edited", "Your instructions have been applied by AI.");
      } else {
        throw new Error(response.error || "Failed to edit transformation.");
      }
    } catch (error: any) {
      console.error("Edit transformation error:", error);
      toast.error("Edit failed", error?.message || "Could not apply instructions.");
      throw error;
    } finally {
      setEditing(false);
    }
  };

  const handleUndo = () => {
    if (!canUndo) return;
    const targetIndex = activeHistory.index - 1;
    const prevContent = activeHistory.history[targetIndex];
    const stringified = typeof prevContent === "string" ? prevContent : JSON.stringify(prevContent, null, 2);

    setHistoryStore((prev) => ({
      ...prev,
      [work]: { ...activeHistory, index: targetIndex },
    }));
    setContent(stringified);
    if (activeResult) {
      setGenerated({ ...activeResult, content: stringified });
    }
    toast.info("Undo applied", `Reverted to version ${targetIndex + 1}`);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const targetIndex = activeHistory.index + 1;
    const nextContent = activeHistory.history[targetIndex];
    const stringified = typeof nextContent === "string" ? nextContent : JSON.stringify(nextContent, null, 2);

    setHistoryStore((prev) => ({
      ...prev,
      [work]: { ...activeHistory, index: targetIndex },
    }));
    setContent(stringified);
    if (activeResult) {
      setGenerated({ ...activeResult, content: stringified });
    }
    toast.info("Redo applied", `Advanced to version ${targetIndex + 1}`);
  };

  return (
    <div className="space-y-5">
      <div className="anim-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[26px]">
            Generated {meta.label}
          </h1>
          <p className="mt-1 text-[14px] text-mute">
            Review your generated outputs below. Switch tabs to view each selected transformation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSocial ? (
            <>
              <Button variant="secondary" onClick={copy} icon={<Copy className="h-4 w-4" />}>
                Copy Output
              </Button>
              <Button variant="primary" onClick={downloadImage} icon={<Download className="h-4 w-4" />}>
                Download Media Asset
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={copy} icon={<Copy className="h-4 w-4" />}>
                Copy
              </Button>
              <Button variant="secondary" onClick={downloadTxt} icon={<FileDown className="h-4 w-4" />}>
                Download TXT
              </Button>
              <Button variant="primary" onClick={downloadPdf} icon={<Download className="h-4 w-4" />}>
                Download PDF
              </Button>
            </>
          )}
          <IconButton label="Share" onClick={() => setShare(true)}>
            <Share2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <WorkspaceStepper current="preview" />

      {/* Multi-result navigation tabs */}
      {validResults.length > 1 && (
        <div className="anim-slide-up flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
          <span className="px-2 text-xs font-bold text-mute uppercase">Outputs ({validResults.length}):</span>
          {validResults.map((res) => {
            const active = res.transformation === work;
            const resMeta = TRANS_META[res.transformation];
            return (
              <button
                key={res.transformation}
                onClick={() => {
                  if (setSelectedTransformation) setSelectedTransformation(res.transformation);
                  setGenerated(res);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer",
                  active
                    ? "bg-brand text-white shadow-md"
                    : "bg-s2 text-mute hover:bg-s3 hover:text-ink"
                )}
              >
                <TransformationGlyph id={res.transformation} className="h-5 w-5 rounded-md" />
                {resMeta.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Config + editing */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4.5 py-3">
              <h2 className="text-sm font-bold text-ink">Active Transformation</h2>
            </div>
            <div className="space-y-2.5 p-4">
              <div className="flex items-center gap-3 rounded-xl bg-s2/50 p-2.5">
                <TransformationGlyph id={work} className="h-8 w-8" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">{meta.label}</p>
                  <p className="text-[11px] text-mute">English · fixed language</p>
                </div>
              </div>
              {[
                { k: "Tone", v: toneLabel },
                { k: "Length", v: lengthLabel },
                { k: "Audience", v: audienceLabel },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between px-1 text-[13px]">
                  <span className="text-mute">{row.k}</span>
                  <span className="font-semibold text-ink">{row.v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-1 text-[13px]">
                <span className="text-mute">Source Document</span>
                <span className="font-semibold text-ink">
                  {readyFiles[0] ? (readyFiles[0].name.length > 20 ? readyFiles[0].name.slice(0, 20) + "…" : readyFiles[0].name) : "—"}
                </span>
              </div>
            </div>
            <div className="border-t border-line p-3.5">
              <Button variant="secondary" className="w-full" loading={regen} onClick={doRegen} icon={!regen ? <RefreshCw className="h-4 w-4" /> : undefined}>
                {regen ? "Generating alternative…" : "Regenerate"}
              </Button>
              <Button variant="ghost" className="mt-1.5 w-full" onClick={() => navigate("/workspace/configure")}>
                <ArrowLeft className="h-4 w-4" /> Back to Configure
              </Button>
            </div>
          </Card>

          {/* ERA AI TEAM Display */}
          <AiTeamDisplay config={aiConfig} metrics={activeMetrics} cumulative={cumulativeStats} />

          {/* AI Edit with Additional Instructions */}
          <AdditionalInstructions
            transformationId={work}
            documentId={activeResult?.document_id || currentDocId}
            currentOutput={content}
            onApplyEdit={handleApplyEdit}
            loading={editing}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            versionCount={activeHistory.history.length}
            currentVersionIndex={activeHistory.index}
          />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4.5 py-3">
              <h2 className="text-sm font-bold text-ink">Edit content</h2>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-soft">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live preview
                </span>
              </div>
            </div>
            <div className="p-3.5">
              <textarea
                value={content}
                onChange={(e) => updateContent(e.target.value)}
                aria-label="Edit generated content"
                className="focus-ring h-64 w-full resize-y rounded-xl border border-line bg-s2/60 p-3.5 text-[13px] leading-relaxed text-ink focus:border-brand"
              />
              <p className="mt-2 text-[11px] text-soft">Tip: Edit prompt details, post copy or script lines. The preview updates automatically.</p>
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-brand" />
              <h2 className="text-[15px] font-bold text-ink">Live Studio Preview</h2>
            </div>
            <Badge className={badgeTone.info}>{isSocial ? "Platform / Studio view" : "Document view"}</Badge>
          </div>
          <div className={cn("anim-fade flex justify-center overflow-hidden rounded-2xl border border-line bg-s3/40 p-4 sm:p-8", isSocial && "bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent_60%)]")}>
            <PlatformPreview work={work} content={content} />
          </div>
          <p className="text-center text-[11.5px] text-soft">
            Previewing {meta.label}. Use tabs above to toggle between all generated outputs.
          </p>
        </div>
      </div>

      {/* Share Modal */}
      <Modal open={share} onClose={() => setShare(false)} title="Share document" description="Share this generated result with colleagues." size="sm">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-s2/60 p-3">
          <Link2 className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-mute">https://era.workspace/share/{activeResult?.id || "result"}</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">People in your government workspace with the link can view this result. Your workspace is private.</p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setShare(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`https://era.workspace/share/${activeResult?.id || "result"}`);
                toast.success("Link copied", "Share link copied to clipboard.");
              } catch {
                toast.error("Could not copy", "Clipboard access was blocked.");
              }
            }}
          >
            <Link2 className="h-4 w-4" /> Copy link
          </Button>
        </div>
      </Modal>
    </div>
  );
}
