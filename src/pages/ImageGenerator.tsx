import { useState } from "react";
import { Image as ImageIcon, Sparkles, Wand2 } from "lucide-react";
import { ImageGenerationPanel } from "../components/media/ImageGenerationPanel";
import { Card, PageSkeleton, usePageReady } from "../components/ui";

const SUGGESTED_PROMPTS = [
  {
    title: "Government SaaS Platform",
    prompt:
      "Create a professional modern illustration of an AI-powered government document management platform. Show a secure government office environment with digital documents, AI transformation, intelligent document processing, and enterprise technology. Use a clean premium light aesthetic with blue, indigo, and violet accents. Make the image professional, trustworthy, modern, and suitable for a government enterprise SaaS application.",
  },
  {
    title: "Executive Policy Briefing",
    prompt:
      "A clean minimal infographic vector graphic representing executive policy synthesis, digital document workflows, security badges, and data analytics dashboards.",
  },
  {
    title: "Smart Public Sector Office",
    prompt:
      "Futuristic high-tech government administration hall with modern glass computers, digital screens displaying transformation analytics, and clean architectural lighting.",
  },
];

export default function ImageGenerator() {
  const ready = usePageReady();
  const [activePrompt, setActivePrompt] = useState<string>("");

  if (!ready) return <PageSkeleton variant="grid" />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-4">
      {/* Page Header */}
      <div className="anim-slide-up flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-md">
              <ImageIcon className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              AI Image Generator
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-gray-400">
            Create enterprise visual assets using ERA's Visual Media Engine.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> AI Media Engine
          </span>
        </div>
      </div>

      {/* Main Generator Section */}
      <div className="anim-slide-up" style={{ animationDelay: "40ms" }}>
        <ImageGenerationPanel
          key={activePrompt}
          initialPrompt={activePrompt}
          className="shadow-xl"
        />
      </div>

      {/* Suggested Test Prompts */}
      <div className="anim-slide-up space-y-3" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sample Government & Enterprise Prompts</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SUGGESTED_PROMPTS.map((item) => (
            <Card
              key={item.title}
              onClick={() => setActivePrompt(item.prompt)}
              className="p-4 cursor-pointer hover:border-brand/40 hover:bg-s2/70 transition-all text-left flex flex-col justify-between group"
            >
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-brand transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[11.5px] text-slate-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                  "{item.prompt}"
                </p>
              </div>
              <span className="mt-3 text-[11px] font-semibold text-brand flex items-center gap-1 group-hover:underline">
                Use this prompt →
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
