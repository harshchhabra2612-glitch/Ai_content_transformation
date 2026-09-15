import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, FileText, Lock, RefreshCw, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import WorkspaceStepper from "../components/WorkspaceStepper";
import { AUDIENCES, LENGTHS, tonesFor } from "../data/mock";
import { generateTitle, generationStepsFor } from "../services/ai";
import { getAiConfig, sendChatMessage, uploadDocument, type AiConfig, type AiMetrics } from "../services/api";
import { AiTeamDisplay } from "../components/AiTeamDisplay";
import { Badge, Button, Card, EmptyState, Field, FileGlyph, Select, TRANS_META, TransformationGlyph, badgeTone } from "../components/ui";
import { cn } from "../utils/cn";
import type { AppFile, AudienceId, GeneratedResult, LengthId, ToneId, TransformationId } from "../types";

function getRawFileToUpload(fileMeta: AppFile): File | null {
  if (fileMeta.rawFile && fileMeta.rawFile instanceof File && fileMeta.rawFile.size > 0) {
    return fileMeta.rawFile;
  }
  return null;
}

export default function WorkspaceConfigure() {
  const { sessionFiles, selectedTransformations, selectedTransformation, wsConfig, updateWsConfig, setGenerated, setGeneratedResults, persistGeneratedOutput } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const runTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [lastMetrics, setLastMetrics] = useState<AiMetrics | null>(null);
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

  const selectedWorks: TransformationId[] = selectedTransformations.length > 0
    ? selectedTransformations
    : selectedTransformation ? [selectedTransformation] : ["executive-brief"];

  const [tone, setTone] = useState<ToneId>(wsConfig.tone);
  const [length, setLength] = useState<LengthId>(wsConfig.length);
  const [audience, setAudience] = useState<AudienceId>(wsConfig.audience);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  const primaryWork = selectedWorks[0];
  const readyFiles = sessionFiles.filter((f) => f.status === "ready");

  useEffect(() => {
    const primaryFile = readyFiles[0];
    const docId = primaryFile?.document_id || primaryFile?.fileId || primaryFile?.id;
    if (docId) {
      console.log(`[ERA CONFIGURE] document_id received ${docId}`);
      console.log(`[ERA CONFIGURE] transformation received ${primaryWork}`);
    }
  }, [readyFiles, primaryWork]);

  // Keep the tone in sync with available tone options
  useEffect(() => {
    if (!primaryWork) return;
    const opts = tonesFor(primaryWork);
    if (!opts.some((t) => t.id === tone)) {
      setTone(opts[0].id);
      updateWsConfig({ tone: opts[0].id });
    }
  }, [primaryWork]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedWorks.length === 0 || !primaryWork) {
    return (
      <div className="space-y-5">
        <WorkspaceStepper current="configure" />
        <Card>
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="No work types selected"
            description="Choose what you want to create before configuring your output."
            action={
              <Button variant="primary" onClick={() => navigate("/workspace/select")}>
                Choose Work
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const primaryMeta = TRANS_META[primaryWork];
  const toneOptions = tonesFor(primaryWork);
  const labelOf = (arr: { id: string; label: string }[], id: string) => arr.find((t) => t.id === id)?.label ?? id;

  const updateTone = (id: ToneId) => {
    setTone(id);
    updateWsConfig({ tone: id });
  };

  const run = async () => {
    if (running) return;

    if (readyFiles.length === 0) {
      toast.error(
        "No source document",
        "Upload a document before generating content."
      );
      return;
    }

    setRunning(true);
    setStep(0);

    const steps = generationStepsFor(primaryWork);

    steps.forEach((_, i) => {
      const t = setTimeout(() => setStep(i), i * 700);
      runTimers.current.add(t);
    });

    try {
      const primaryFile = readyFiles[0];
      let docId = primaryFile.document_id || primaryFile.fileId || primaryFile.id;

      // If document_id is not available yet, attempt fallback upload if rawFile exists
      if (!primaryFile.document_id) {
        const fileToUpload = getRawFileToUpload(primaryFile);
        if (fileToUpload) {
          try {
            const uploadRes = await uploadDocument(fileToUpload);
            if (uploadRes?.document_id) {
              docId = uploadRes.document_id;
            }
          } catch (uploadError: any) {
            console.warn("Fallback PDF upload error during generation:", uploadError);
          }
        }
      }

      // Query backend or client generator for each selected transformation
      const results: GeneratedResult[] = [];

      for (const wId of selectedWorks) {
        let contentText = "";
        let structuredDataObj: any = undefined;
        let respMetrics: any = null;

        try {
          const response = await sendChatMessage({
            document_id: docId,
            transformation: wId,
            tone,
            length,
            audience,
          });
          contentText = response.answer;

          if (response.model || response.usage) {
            respMetrics = {
              model: response.model || "qwen-7b",
              temperature: response.temperature ?? 0.2,
              max_tokens: response.max_tokens ?? 1000,
              usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              latency_ms: response.latency_ms ?? 0,
            };
            setLastMetrics(respMetrics);

            // Update cumulative session stats
            setCumulativeStats((prev: any) => {
              const u = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
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
        } catch (apiErr: any) {
          console.error("[BACKEND QUERY ERROR]:", apiErr);
          const errMsg = apiErr?.response?.data?.detail || apiErr?.message || "Failed to generate transformation from document content.";
          toast.error("Generation Failed", errMsg);
          contentText = JSON.stringify({
            transformation: wId,
            error: errMsg,
            slides: [],
          });
        }

        const now = new Date().toISOString();
        const creatorName = user?.name || user?.email || "Authenticated User";
        const resObj: GeneratedResult = {
          id: Math.random().toString(36).slice(2, 10),
          output_id: "out_" + Math.random().toString(36).slice(2, 10),
          document_id: docId,
          title: generateTitle(wId, primaryFile.name),
          content: contentText,
          transformation: wId,
          source: {
            document_id: docId,
            filename: primaryFile.filename || primaryFile.name,
            title: primaryFile.title || primaryFile.name,
          },
          createdBy: {
            uid: user?.user_id || "auth_user",
            name: creatorName,
            email: user?.email || "",
          },
          createdAt: now,
          updatedAt: now,
          structuredData: structuredDataObj,
          model: respMetrics?.model,
          temperature: respMetrics?.temperature,
          max_tokens: respMetrics?.max_tokens,
          usage: respMetrics?.usage,
          latency_ms: respMetrics?.latency_ms,
        };

        results.push(resObj);

        // PERSIST OUTPUT TO FIRESTORE (Requirement 11, 12, 34)
        try {
          await persistGeneratedOutput({
            transformation: wId,
            title: resObj.title,
            content: contentText,
            structuredData: structuredDataObj,
          });
        } catch (persistErr) {
          console.warn("[PERSIST OUTPUT WARNING]:", persistErr);
        }
      }

      setGeneratedResults(results);

      if (results[0]) {
        setGenerated(results[0]);
      }

      toast.success(
        results.length > 1
          ? `${results.length} transformations ready!`
          : `${primaryMeta.label} is ready!`,
        "Content generated and persisted to your document workspace."
      );

      navigate("/workspace/preview");
    } catch (error) {
      console.error("Content generation error:", error);

      toast.error(
        "Generation failed",
        "Could not generate content. Please check document and try again."
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="anim-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[26px]">Configure your outputs</h1>
          <p className="mt-1 text-[14px] text-mute">
            Fine-tune options for {selectedWorks.length} selected transformation{selectedWorks.length > 1 ? "s" : ""}.
          </p>
        </div>
        <button
          onClick={() => navigate("/workspace/select")}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-mute transition hover:border-line2 hover:text-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Change work types ({selectedWorks.length})
        </button>
      </div>
      <WorkspaceStepper current="configure" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Selected Work List */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4.5 py-3">
              <h2 className="text-sm font-bold text-ink">Selected Transformations</h2>
              <Badge className={badgeTone.brand}>{selectedWorks.length} selected</Badge>
            </div>
            <div className="divide-y divide-line p-1">
              {selectedWorks.map((wId) => {
                const meta = TRANS_META[wId];
                return (
                  <div key={wId} className="flex items-center gap-3.5 p-3">
                    <TransformationGlyph id={wId} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-ink">{meta.label}</p>
                      <p className="text-xs text-mute">
                        {toneOptions.find((t) => t.id === tone)?.label ?? labelOf(toneOptions, tone)} · {labelOf(LENGTHS, length)}
                      </p>
                    </div>
                    <Badge className={badgeTone.success}>
                      <Check className="h-3 w-3" /> Ready
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Files */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4.5 py-3">
              <h2 className="text-sm font-bold text-ink">Source documents</h2>
              <Badge className={badgeTone.brand}>{readyFiles.length}</Badge>
            </div>
            <div className="space-y-1.5 p-3.5">
              {readyFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl bg-s2/50 p-2.5">
                  <FileGlyph kind={f.kind} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink">{f.name}</p>
                    <p className="text-[10.5px] text-mute">{f.kind.toUpperCase()} · Ready</p>
                  </div>
                </div>
              ))}
              <p className="px-1 pt-1 text-[11px] text-soft">
                {readyFiles.length > 1 ? `${readyFiles.length} documents will be used together.` : "This document will be used as the source."}
              </p>
            </div>
          </Card>

          {/* ERA AI TEAM Display */}
          <AiTeamDisplay config={aiConfig} metrics={lastMetrics} cumulative={cumulativeStats} />
        </div>

        {/* Configuration */}
        <Card className="h-fit overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4.5 py-3.5">
            <Sparkles className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-bold text-ink">Configuration Parameters</h2>
            <span className="ml-auto text-[11px] font-semibold text-soft">Language: English only</span>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <Field label="Tone">
              <Select value={tone} onChange={(e) => updateTone(e.target.value as ToneId)} aria-label="Tone">
                {toneOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Length" hint="How much detail you want in the outputs">
              <Select
                value={length}
                onChange={(e) => {
                  const v = e.target.value as LengthId;
                  setLength(v);
                  updateWsConfig({ length: v });
                }}
                aria-label="Length"
              >
                {LENGTHS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — {t.hint}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Audience">
              <Select
                value={audience}
                onChange={(e) => {
                  const v = e.target.value as AudienceId;
                  setAudience(v);
                  updateWsConfig({ audience: v });
                }}
                aria-label="Audience"
              >
                {AUDIENCES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Fixed language */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-s2/50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-infosoft text-info">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Language</p>
                  <p className="text-[11px] text-mute">ERA currently generates content in English.</p>
                </div>
              </div>
              <Badge className={badgeTone.info}>English</Badge>
            </div>

            <div className="border-t border-line pt-5">
              <Button variant="primary" size="lg" className="w-full" loading={running} onClick={run} icon={!running ? <Sparkles className="h-4.5 w-4.5" /> : undefined}>
                {running ? "Generating Content…" : `Generate Content (${selectedWorks.length})`}
              </Button>
              {running && (
                <div className="anim-fade mt-4 rounded-xl border border-brand/20 bg-brandsoft/40 p-4">
                  {generationStepsFor(primaryWork).map((s, i) => (
                    <div key={s} className={cn("flex items-center gap-2 py-1 text-xs", i < step ? "text-mute line-through opacity-60" : i === step ? "font-semibold text-brandink" : "text-soft")}>
                      {i < step ? <Check className="h-3 w-3" /> : i === step ? <Sparkles className="h-3 w-3 animate-pulse" /> : <span className="h-3 w-3" />}
                      {s}
                    </div>
                  ))}
                </div>
              )}
              {!running && (
                <p className="mt-3 flex items-center gap-1.5 text-center text-[11.5px] text-soft">
                  <FileText className="h-3.5 w-3.5" /> Generating {selectedWorks.length} outputs from {readyFiles[0]?.name ?? "your document"} in English
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/workspace/select")}>
          ← Back to Choose Work
        </Button>
        <Button variant="secondary" onClick={() => { updateWsConfig({ tone, length, audience }); toast.success("Defaults saved", "Your configuration preferences were saved."); }}>
          Save as defaults <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
