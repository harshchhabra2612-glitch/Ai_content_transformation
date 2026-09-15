import React from "react";
import { Cpu, Activity, Zap, Sparkles } from "lucide-react";
import { Card, Badge, badgeTone } from "./ui";
import type { AiConfig, AiMetrics, TokenUsage } from "../services/api";

interface AiTeamDisplayProps {
  metrics?: AiMetrics | null;
  config?: AiConfig | null;
  cumulative?: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  } | null;
  className?: string;
}

export const AiTeamDisplay: React.FC<AiTeamDisplayProps> = ({
  metrics,
  config,
  cumulative,
  className = "",
}) => {
  const modelName = metrics?.model || config?.model || "qwen-7b";
  const temp = metrics?.temperature ?? config?.temperature ?? 0.2;
  const maxTokens = metrics?.max_tokens ?? config?.max_tokens ?? 1000;

  const usage: TokenUsage = metrics?.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  const latencySec = metrics?.latency_ms
    ? (metrics.latency_ms / 1000).toFixed(2) + "s"
    : "—";

  const formatNumber = (num: number) => num.toLocaleString("en-US");

  return (
    <Card className={`overflow-hidden border border-line bg-surface shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-s2/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
            ERA 2-MODEL AI TEAM
          </h3>
        </div>
        <Badge className={badgeTone.brand}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 mr-1" />
          Active
        </Badge>
      </div>

      {/* Model & Engine Banner */}
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between rounded-xl bg-gradient-to-r from-brand/10 via-brand/5 to-transparent p-3.5 border border-brand/15">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-md">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />
                <h4 className="text-sm font-extrabold text-ink">Qwen-7B & MiniCPM</h4>
              </div>
              <p className="text-[11px] font-medium text-mute">MiniCPM (Extractor) + Qwen-7B (Reasoning)</p>
            </div>
          </div>
        </div>


        {/* Configurations */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs border-b border-line pb-3">
          <div className="rounded-lg bg-s2/60 p-2">
            <p className="text-[10px] font-bold text-mute uppercase">Model</p>
            <p className="font-mono font-semibold text-ink text-[12px] truncate mt-0.5">{modelName}</p>
          </div>
          <div className="rounded-lg bg-s2/60 p-2">
            <p className="text-[10px] font-bold text-mute uppercase">Temperature</p>
            <p className="font-mono font-semibold text-ink text-[12px] mt-0.5">{temp}</p>
          </div>
          <div className="rounded-lg bg-s2/60 p-2">
            <p className="text-[10px] font-bold text-mute uppercase">Max Output Tokens</p>
            <p className="font-mono font-semibold text-ink text-[12px] mt-0.5">{formatNumber(maxTokens)}</p>
          </div>
        </div>

        {/* Real Backend Usage Metrics */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-mute font-medium px-1">
            <span>Input Tokens</span>
            <span className="font-mono font-bold text-ink">
              {metrics ? formatNumber(usage.prompt_tokens) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-mute font-medium px-1">
            <span>Output Tokens</span>
            <span className="font-mono font-bold text-ink">
              {metrics ? formatNumber(usage.completion_tokens) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-mute font-medium px-1 pt-1 border-t border-line/60">
            <span className="font-semibold text-ink">Total Tokens</span>
            <span className="font-mono font-extrabold text-brand">
              {metrics ? formatNumber(usage.total_tokens) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-mute font-medium px-1">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" /> Latency
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {latencySec}
            </span>
          </div>
        </div>

        {/* Cumulative Session Usage */}
        {cumulative && (
          <div className="mt-4 pt-3 border-t border-line space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-mute flex items-center gap-1">
                <Activity className="h-3 w-3 text-brand" /> Cumulative Usage
              </span>
              <span className="text-[10px] font-semibold text-soft">
                {cumulative.totalRequests} req{cumulative.totalRequests !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px] text-center">
              <div className="rounded-lg bg-s2/40 p-1.5">
                <p className="text-[9px] text-mute">Total Input</p>
                <p className="font-mono font-bold text-ink">{formatNumber(cumulative.totalInputTokens)}</p>
              </div>
              <div className="rounded-lg bg-s2/40 p-1.5">
                <p className="text-[9px] text-mute">Total Output</p>
                <p className="font-mono font-bold text-ink">{formatNumber(cumulative.totalOutputTokens)}</p>
              </div>
              <div className="rounded-lg bg-s2/40 p-1.5">
                <p className="text-[9px] text-mute">Total Tokens</p>
                <p className="font-mono font-bold text-brand">{formatNumber(cumulative.totalTokens)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
