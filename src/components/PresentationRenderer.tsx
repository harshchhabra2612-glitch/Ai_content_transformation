import { Camera, CheckCircle2, Quote, Sparkles, TrendingUp } from "lucide-react";
import type { PresentationSlide, PresentationThemeId, PresentationThemeMode } from "../types";
import { cn } from "../utils/cn";
import { mdToHtml } from "../utils/markdown";
import { EraLogo } from "./branding/EraLogo";

interface PresentationRendererProps {
  slide: PresentationSlide;
  theme: PresentationThemeId;
  mode?: PresentationThemeMode;
  totalSlides: number;
  activeIndex?: number;
}

interface ThemeVariantConfig {
  canvasBg: string;
  cardBg: string;
  borderColor: string;
  kickerText: string;
  titleText: string;
  subtitleText: string;
  bodyText: string;
  bulletDot: string;
  badgeBg: string;
  badgeText: string;
  accentBar: string;
  footerText: string;
}

type ColorMode = "light" | "dark";

const THEME_PRESETS: Record<PresentationThemeId, Record<ColorMode, ThemeVariantConfig>> = {
  modern: {
    light: {
      canvasBg: "bg-white text-slate-900",
      cardBg: "bg-indigo-50/60 border border-indigo-100/80 shadow-sm",
      borderColor: "border-slate-200",
      kickerText: "text-indigo-600 font-extrabold tracking-[0.2em]",
      titleText: "text-slate-950 font-extrabold tracking-tight",
      subtitleText: "text-indigo-600/90 font-bold",
      bodyText: "text-slate-700 font-medium",
      bulletDot: "bg-indigo-600 shadow-[0_0_6px_rgba(79,70,229,0.4)]",
      badgeBg: "bg-indigo-100",
      badgeText: "text-indigo-900 font-bold",
      accentBar: "bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600",
      footerText: "text-slate-400 font-medium",
    },
    dark: {
      canvasBg: "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white",
      cardBg: "bg-white/10 backdrop-blur-md border border-white/15 shadow-inner",
      borderColor: "border-white/20",
      kickerText: "text-cyan-400 font-extrabold tracking-[0.2em]",
      titleText: "text-white font-extrabold tracking-tight",
      subtitleText: "text-cyan-300/90 font-semibold",
      bodyText: "text-slate-200",
      bulletDot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
      badgeBg: "bg-white/15",
      badgeText: "text-white font-bold",
      accentBar: "bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500",
      footerText: "text-slate-400",
    },
  },

  corporate: {
    light: {
      canvasBg: "bg-white text-slate-900",
      cardBg: "bg-slate-50 border border-slate-200 shadow-sm",
      borderColor: "border-slate-300",
      kickerText: "text-sky-800 font-extrabold tracking-[0.18em]",
      titleText: "text-sky-950 font-extrabold tracking-tight",
      subtitleText: "text-sky-700 font-semibold",
      bodyText: "text-slate-800",
      bulletDot: "bg-sky-800",
      badgeBg: "bg-sky-100",
      badgeText: "text-sky-900 font-bold",
      accentBar: "bg-gradient-to-r from-sky-800 via-blue-700 to-indigo-900",
      footerText: "text-slate-500",
    },
    dark: {
      canvasBg: "bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white",
      cardBg: "bg-sky-900/30 border border-sky-500/30 backdrop-blur-sm",
      borderColor: "border-sky-500/30",
      kickerText: "text-sky-400 font-extrabold tracking-[0.2em]",
      titleText: "text-white font-extrabold",
      subtitleText: "text-sky-300/90 font-semibold",
      bodyText: "text-slate-200",
      bulletDot: "bg-sky-400",
      badgeBg: "bg-sky-500/20 border border-sky-500/30",
      badgeText: "text-sky-300 font-bold",
      accentBar: "bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600",
      footerText: "text-slate-400",
    },
  },

  academic: {
    light: {
      canvasBg: "bg-[#faf8f5] text-[#1c1917]",
      cardBg: "bg-[#f5f2eb] border border-[#e7e5e4] shadow-sm",
      borderColor: "border-[#d6d3d1]",
      kickerText: "text-[#991b1b] font-bold tracking-[0.2em]",
      titleText: "text-[#1c1917] font-serif font-extrabold tracking-tight",
      subtitleText: "text-[#991b1b] font-serif italic font-semibold",
      bodyText: "text-[#292524] font-serif leading-relaxed",
      bulletDot: "bg-[#991b1b]",
      badgeBg: "bg-[#e7e5e4]",
      badgeText: "text-[#1c1917] font-bold",
      accentBar: "bg-gradient-to-r from-[#991b1b] via-[#b91c1c] to-[#78350f]",
      footerText: "text-[#78716c]",
    },
    dark: {
      canvasBg: "bg-[#1c1917] text-[#f5f5f4]",
      cardBg: "bg-[#292524] border border-[#44403c] shadow-md",
      borderColor: "border-[#44403c]",
      kickerText: "text-[#f59e0b] font-bold tracking-[0.2em]",
      titleText: "text-[#f5f5f4] font-serif font-extrabold tracking-tight",
      subtitleText: "text-[#f59e0b] font-serif italic font-semibold",
      bodyText: "text-[#d6d3d1] font-serif leading-relaxed",
      bulletDot: "bg-[#f59e0b]",
      badgeBg: "bg-[#44403c]",
      badgeText: "text-[#f5f5f4] font-bold",
      accentBar: "bg-gradient-to-r from-[#f59e0b] via-[#d97706] to-[#b45309]",
      footerText: "text-[#a8a29e]",
    },
  },

  government: {
    light: {
      canvasBg: "bg-white text-slate-900",
      cardBg: "bg-amber-50/70 border border-amber-200/80 shadow-sm",
      borderColor: "border-slate-300",
      kickerText: "text-amber-800 font-extrabold tracking-[0.2em]",
      titleText: "text-slate-950 font-extrabold tracking-tight",
      subtitleText: "text-amber-800 font-bold",
      bodyText: "text-slate-800 font-medium",
      bulletDot: "bg-amber-700",
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-950 font-bold",
      accentBar: "bg-gradient-to-r from-amber-600 via-indigo-900 to-blue-900",
      footerText: "text-slate-500",
    },
    dark: {
      canvasBg: "bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white",
      cardBg: "bg-slate-850/80 border border-amber-500/30 shadow-lg",
      borderColor: "border-amber-500/30",
      kickerText: "text-amber-400 font-extrabold tracking-[0.2em]",
      titleText: "text-white font-extrabold",
      subtitleText: "text-amber-300/90 font-semibold",
      bodyText: "text-slate-100",
      bulletDot: "bg-amber-400",
      badgeBg: "bg-amber-500/20 border border-amber-500/40",
      badgeText: "text-amber-300 font-bold",
      accentBar: "bg-gradient-to-r from-amber-400 via-yellow-500 to-indigo-600",
      footerText: "text-slate-400",
    },
  },

  gradient: {
    light: {
      canvasBg: "bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 text-slate-900",
      cardBg: "bg-white/80 backdrop-blur-md border border-purple-200 shadow-md",
      borderColor: "border-purple-200",
      kickerText: "text-purple-700 font-extrabold tracking-[0.2em]",
      titleText: "text-slate-950 font-black tracking-tight",
      subtitleText: "text-indigo-600 font-semibold",
      bodyText: "text-slate-800",
      bulletDot: "bg-purple-600 shadow-sm",
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-900 font-bold",
      accentBar: "bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600",
      footerText: "text-slate-500",
    },
    dark: {
      canvasBg: "bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white",
      cardBg: "bg-white/15 backdrop-blur-md border border-white/25 shadow-xl",
      borderColor: "border-white/30",
      kickerText: "text-pink-300 font-extrabold tracking-[0.2em]",
      titleText: "text-white font-black",
      subtitleText: "text-pink-200 font-semibold",
      bodyText: "text-white/95",
      bulletDot: "bg-pink-300 shadow",
      badgeBg: "bg-white/20",
      badgeText: "text-white font-bold",
      accentBar: "bg-gradient-to-r from-pink-400 via-purple-300 to-white",
      footerText: "text-white/60",
    },
  },

  // Fallbacks mapping
  professional: {
    light: {
      canvasBg: "bg-white text-slate-900",
      cardBg: "bg-slate-50 border border-slate-200",
      borderColor: "border-slate-200",
      kickerText: "text-indigo-600 font-extrabold tracking-[0.2em]",
      titleText: "text-slate-900 font-extrabold",
      subtitleText: "text-indigo-600/90 font-semibold",
      bodyText: "text-slate-700",
      bulletDot: "bg-indigo-600",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-800 font-bold",
      accentBar: "bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600",
      footerText: "text-slate-400",
    },
    dark: {
      canvasBg: "bg-slate-900 text-white",
      cardBg: "bg-slate-800/80 border border-slate-700",
      borderColor: "border-slate-700",
      kickerText: "text-indigo-400 font-extrabold tracking-[0.2em]",
      titleText: "text-white font-extrabold",
      subtitleText: "text-indigo-300 font-semibold",
      bodyText: "text-slate-200",
      bulletDot: "bg-indigo-400",
      badgeBg: "bg-slate-800",
      badgeText: "text-slate-200 font-bold",
      accentBar: "bg-gradient-to-r from-indigo-400 via-violet-500 to-blue-500",
      footerText: "text-slate-400",
    },
  },

  minimal: {
    light: {
      canvasBg: "bg-slate-50 text-slate-900",
      cardBg: "bg-white border border-slate-300 shadow-sm",
      borderColor: "border-slate-300",
      kickerText: "text-slate-500 font-bold tracking-[0.2em]",
      titleText: "text-slate-950 font-black",
      subtitleText: "text-slate-600 font-medium",
      bodyText: "text-slate-800",
      bulletDot: "bg-slate-950",
      badgeBg: "bg-slate-200",
      badgeText: "text-slate-900 font-bold",
      accentBar: "bg-slate-950",
      footerText: "text-slate-400",
    },
    dark: {
      canvasBg: "bg-slate-950 text-slate-100",
      cardBg: "bg-slate-900 border border-slate-800 shadow-sm",
      borderColor: "border-slate-800",
      kickerText: "text-slate-400 font-bold tracking-[0.2em]",
      titleText: "text-white font-black",
      subtitleText: "text-slate-300 font-medium",
      bodyText: "text-slate-200",
      bulletDot: "bg-white",
      badgeBg: "bg-slate-800",
      badgeText: "text-white font-bold",
      accentBar: "bg-white",
      footerText: "text-slate-500",
    },
  },
};

export default function PresentationRenderer({
  slide,
  theme = "modern",
  mode = "light",
  totalSlides,
}: PresentationRendererProps) {
  const selectedTheme = THEME_PRESETS[theme] || THEME_PRESETS.modern;
  const cfg = selectedTheme[mode] || selectedTheme.light;
  const layout = slide.layout || "content";

  return (
    <div
      className={cn(
        "relative flex aspect-[16/9] w-full flex-col justify-between overflow-hidden rounded-2xl p-6 sm:p-8 text-left transition-all duration-300 shadow-xl border",
        cfg.canvasBg,
        cfg.borderColor
      )}
    >
      {/* Top Decorative Accent Bar */}
      <div className={cn("absolute top-0 inset-x-0 h-1.5", cfg.accentBar)} />

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] uppercase flex items-center gap-1.5 font-extrabold", cfg.kickerText)}>
          <Sparkles className="h-3.5 w-3.5" /> ERA Presentation Studio
        </span>
        <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm", cfg.badgeBg, cfg.badgeText)}>
          {String(slide.slide_number).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
        </span>
      </div>

      {/* Slide Body Container based on Layout Type */}
      <div className="my-auto space-y-4 overflow-y-auto pr-1">
        {/* LAYOUT: Title Cover Slide */}
        {layout === "title" && (
          <div className="flex flex-col justify-center space-y-4 py-4 text-center sm:text-left">
            <span className={cn("text-xs uppercase tracking-widest font-extrabold", cfg.kickerText)}>
              Official Presentation Output
            </span>
            <h1 className={cn("text-2xl sm:text-4xl leading-tight font-extrabold tracking-tight", cfg.titleText)}>
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className={cn("text-base sm:text-xl leading-snug font-semibold max-w-2xl", cfg.subtitleText)}>
                {slide.subtitle}
              </p>
            )}
            {slide.body && (
              <p className={cn("text-xs sm:text-sm leading-relaxed max-w-xl", cfg.bodyText)}>{slide.body}</p>
            )}
          </div>
        )}

        {/* LAYOUT: Section Divider */}
        {layout === "section" && (
          <div className="flex flex-col justify-center space-y-3 py-6">
            <span className={cn("text-xs font-mono uppercase tracking-widest font-bold", cfg.kickerText)}>
              Section {slide.slide_number}
            </span>
            <h2 className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight border-l-4 pl-4 border-current", cfg.titleText)}>
              {slide.title}
            </h2>
            {slide.subtitle && <p className={cn("text-sm sm:text-lg font-semibold pl-4", cfg.subtitleText)}>{slide.subtitle}</p>}
          </div>
        )}

        {/* LAYOUT: Statistics Callout */}
        {layout === "statistics" && (
          <div className="space-y-4">
            {slide.title && <h3 className={cn("text-xl sm:text-2xl font-extrabold", cfg.titleText)}>{slide.title}</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className={cn("flex flex-col items-center justify-center p-5 rounded-2xl text-center shadow-sm", cfg.cardBg)}>
                <span className="text-4xl sm:text-5xl font-black text-brand tracking-tight">
                  {slide.statNumber || "100%"}
                </span>
                <span className={cn("mt-2 text-xs font-bold uppercase tracking-wider", cfg.subtitleText)}>
                  {slide.statLabel || slide.subtitle || "Key Data Point"}
                </span>
              </div>
              <div className="space-y-2">
                {slide.bullets &&
                  slide.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                      <TrendingUp className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                      <span className={cfg.bodyText}>{b}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT: Key Policy Quote */}
        {layout === "quote" && (
          <div className={cn("p-6 rounded-2xl space-y-3 relative overflow-hidden shadow-sm", cfg.cardBg)}>
            <Quote className="h-10 w-10 text-brand/20 absolute top-3 right-3" />
            <p className={cn("text-base sm:text-lg italic font-semibold leading-relaxed", cfg.titleText)}>
              "{slide.title || slide.body}"
            </p>
            {slide.quoteAuthor && (
              <p className={cn("text-xs font-bold uppercase tracking-wider text-right", cfg.kickerText)}>
                — {slide.quoteAuthor}
              </p>
            )}
            {slide.bullets && slide.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs sm:text-sm border-t border-line/40 pt-3">
                {slide.bullets.map((b, i) => (
                  <li key={i} className={cn("flex items-center gap-2", cfg.bodyText)}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* LAYOUT: Two Column */}
        {layout === "two_column" && (
          <div className="space-y-3">
            {slide.title && <h3 className={cn("text-xl sm:text-2xl font-extrabold", cfg.titleText)}>{slide.title}</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-xl space-y-2 shadow-sm", cfg.cardBg)}>
                <h4 className={cn("text-xs font-extrabold uppercase tracking-wider", cfg.kickerText)}>
                  {slide.columns?.[0]?.title || "Key Requirement"}
                </h4>
                <p className={cn("text-xs sm:text-sm leading-relaxed", cfg.bodyText)}>
                  {slide.columns?.[0]?.text || slide.body || "Overview details"}
                </p>
              </div>
              <div className={cn("p-4 rounded-xl space-y-2 shadow-sm", cfg.cardBg)}>
                <h4 className={cn("text-xs font-extrabold uppercase tracking-wider", cfg.kickerText)}>
                  {slide.columns?.[1]?.title || "Specific Provisions"}
                </h4>
                <ul className="space-y-1.5 text-xs">
                  {(slide.columns?.[1]?.bullets || slide.bullets || []).map((b, i) => (
                    <li key={i} className={cn("flex items-start gap-2", cfg.bodyText)}>
                      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", cfg.bulletDot)} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT: Content / Key Points (Default Layout) */}
        {layout !== "title" &&
          layout !== "section" &&
          layout !== "statistics" &&
          layout !== "quote" &&
          layout !== "two_column" && (
            <div className="space-y-3">
              {slide.title && (
                <h3 className={cn("text-xl sm:text-2xl font-extrabold tracking-tight leading-tight", cfg.titleText)}>
                  {slide.title}
                </h3>
              )}

              {slide.subtitle && (
                <p className={cn("text-xs sm:text-sm font-semibold leading-snug", cfg.subtitleText)}>
                  {slide.subtitle}
                </p>
              )}

              {slide.bullets && slide.bullets.length > 0 && (
                <ul className="mt-2 space-y-2.5 text-xs sm:text-sm">
                  {slide.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 leading-relaxed">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", cfg.bulletDot)} />
                      <span className={cfg.bodyText}>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {slide.body && (
                <div
                  className={cn("output-editor mt-2 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap", cfg.bodyText)}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(slide.body) }}
                />
              )}
            </div>
          )}

        {/* Visual Element Placeholder if present */}
        {slide.visual && (
          <div className={cn("mt-3 flex items-center gap-3 rounded-xl p-3 text-xs shadow-sm", cfg.cardBg)}>
            <Camera className="h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <span className={cn("font-bold uppercase text-[10px] tracking-wider block", cfg.kickerText)}>
                [Visual Concept: {slide.visual.type || "photo"}]
              </span>
              <span className={cn("truncate block", cfg.bodyText)}>{slide.visual.description}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Bar */}
      <div className={cn("flex items-center justify-between border-t pt-3 text-[11px] font-semibold", cfg.borderColor, cfg.footerText)}>
        <span className="inline-flex items-center gap-1.5">
          <EraLogo variant="mark" size="xs" /> ERA Presentation
        </span>
        <span>Theme: {theme.toUpperCase()} ({mode.toUpperCase()})</span>
      </div>
    </div>
  );
}
