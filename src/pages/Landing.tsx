import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  FileUp,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "../components/ui";
import { TRANSFORMATIONS } from "../data/mock";
import { TRANS_META } from "../components/ui";
import { EraLogo } from "../components/branding/EraLogo";

const STEPS = [
  { icon: FileUp, title: "Upload a document", desc: "Add PDFs, DOCX, PPTX, XLSX or TXT files — up to 25 MB each." },
  { icon: LayoutTemplate, title: "Choose a work type", desc: "From Executive Briefs to LinkedIn and Twitter/X posts." },
  { icon: Workflow, title: "Configure in the workspace", desc: "Set tone, length and audience — content is generated in English." },
  { icon: Sparkles, title: "Preview & export", desc: "Review a realistic platform preview you can edit, copy or download." },
];

const STATS = [
  { value: "13", label: "Work types" },
  { value: "5", label: "File formats" },
  { value: "3", label: "Social previews" },
  { value: "25 MB", label: "Per file" },
];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Landing() {
  return (
    <div className="app-canvas min-h-screen">
      {/* Nav */}
      <header className="glass-strong sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <EraLogo variant="compact" size="md" href="/" />
          </div>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-mute md:flex">
            <button onClick={() => scrollTo("how")} className="transition hover:text-ink">How it works</button>
            <button onClick={() => scrollTo("transformations")} className="transition hover:text-ink">Transformations</button>
            <button onClick={() => scrollTo("enterprise")} className="transition hover:text-ink">Enterprise</button>
            <button onClick={() => scrollTo("insights")} className="transition hover:text-ink">Insights</button>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm" className="hidden sm:inline-flex">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.2),transparent_65%)]" />
          <div className="absolute top-40 -right-32 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.18),transparent_65%)]" />
          <div className="absolute bottom-0 -left-32 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_65%)]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <span className="anim-slide-up inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-xs font-bold text-mute backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-success" /> Built for government workspaces
          </span>
          <h1 className="anim-slide-up mx-auto mt-6 max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-6xl" style={{ animationDelay: "60ms" }}>
            Transform Content.
            <br />
            <span className="text-gradient">Accelerate Government Work.</span>
          </h1>
          <p className="anim-slide-up mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-mute sm:text-lg" style={{ animationDelay: "120ms" }}>
            ERA turns complex documents and information into clear, useful and actionable content — summaries, briefs, reports, emails and more.
          </p>
          <div className="anim-slide-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Link to="/signup">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => scrollTo("how")}>
              Explore ERA
            </Button>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-soft">
            <ShieldCheck className="h-3.5 w-3.5" /> Your workspace is private · No credit card required
          </p>

          {/* Product preview mock */}
          <div className="anim-slide-up relative mx-auto mt-14 max-w-3xl" style={{ animationDelay: "240ms" }}>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-[var(--shadow-pop)] backdrop-blur-xl">
              <div className="flex items-center gap-1.5 border-b border-line bg-s2/60 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs font-semibold text-mute">ERA Workspace — Annual Administrative Report</span>
              </div>
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-[200px_1fr]">
                <div className="hidden border-r border-line p-4 sm:block">
                  {["Dashboard", "Workspace", "Files", "Insights"].map((n, i) => (
                    <div key={n} className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${i === 1 ? "bg-brandsoft text-brandink" : "text-mute"}`}>
                      {i === 1 ? <Sparkles className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded bg-s3" />}
                      {n}
                    </div>
                  ))}
                </div>
                <div className="p-5 text-left">
                  <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-soft uppercase">
                    <Sparkles className="h-3.5 w-3.5 text-brand" /> Generated result · Executive Brief
                  </div>
                  <p className="mt-2 text-[15px] font-extrabold text-ink">Executive Brief</p>
                  <p className="mt-1 text-xs leading-relaxed text-mute">Prepared for senior officers, this brief distils the attached document into its strategic essence.</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-mute"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> Milestone completion at 84% for the reporting period</div>
                    <div className="flex items-center gap-2 text-xs text-mute"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> Budget utilisation at 71% with a healthy forecast position</div>
                    <div className="flex items-center gap-2 text-xs text-mute"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> Two operational risks escalated for management direction</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -right-3 hidden animate-float rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-pop)] sm:block">
              <p className="text-[10px] font-bold text-soft uppercase">Time saved</p>
              <p className="text-lg leading-none font-extrabold text-success">3.2 hrs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4 sm:px-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-extrabold tracking-tight text-ink">{s.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-soft uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">How ERA works</h2>
          <p className="mx-auto mt-2 max-w-lg text-[15px] text-mute">A document-first workflow designed for busy officers and teams.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="group relative rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]">
              <span className="absolute top-4 right-4 text-[13px] font-extrabold text-line2">0{i + 1}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brandsoft text-brand transition-transform duration-200 group-hover:scale-105">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transformations */}
      <section id="transformations" className="border-y border-line bg-surface/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">One document. Thirteen work types.</h2>
            <p className="mx-auto mt-2 max-w-lg text-[15px] text-mute">Turn the same source into whatever your audience needs.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TRANSFORMATIONS.map((t) => {
              const meta = TRANS_META[t.id];
              return (
                <div key={t.id} className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/40">
                  <span className={cnGlyph(meta.gradient)}>
                    <meta.icon className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-ink">{t.label}</p>
                    <p className="text-[12.5px] leading-relaxed text-mute">{t.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enterprise */}
      <section id="enterprise" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-bold text-mute">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Enterprise workflow
          </span>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Built for how government actually works</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">ERA helps departments turn policy drafts, administrative reports and project updates into clear, professional content.</p>
          <ul className="mt-6 space-y-3">
            {[
              "Document-first workflow — upload, transform, deliver",
              "Government-friendly output: briefs, reports, meeting notes",
              "Realistic LinkedIn and Twitter/X platform previews",
              "Workspace that keeps your documents and results together",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-[14.5px] text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-oksoft text-success">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: LayoutTemplate, big: "Executive Brief", small: "from a 40-page report", grad: "from-indigo-500 to-violet-600" },
            { icon: Eye, big: "Platform previews", small: "LinkedIn & X post views", grad: "from-teal-500 to-emerald-600" },
            { icon: BarChart3, big: "Hours saved", small: "on every transformation", grad: "from-sky-500 to-blue-600" },
            { icon: Workflow, big: "5 formats", small: "PDF · DOCX · PPTX · XLSX · TXT", grad: "from-amber-500 to-orange-600" },
          ].map((c) => (
            <div key={c.big} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <span className={cnGlyph(c.grad)}>
                <c.icon className="h-5 w-5 text-white" />
              </span>
              <p className="mt-3 text-[16px] font-extrabold tracking-tight text-ink">{c.big}</p>
              <p className="text-xs text-mute">{c.small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Insights strip */}
      <section id="insights" className="relative overflow-hidden py-16 sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-brand via-brand2 to-brand opacity-95" aria-hidden />
        <div aria-hidden className="absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-sm font-bold tracking-[0.2em] text-white/70 uppercase">Insights that matter</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">Know the impact of your AI transformation program</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-white/80">Usage trends, transformation mix and hours saved — visible to you in a single dashboard.</p>
          <Link to="/signup" className="mt-7 inline-block">
            <Button size="lg" className="!bg-white !text-brand hover:!bg-white/90">
              Start with ERA <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Ready to accelerate your team's work?</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-mute">Join the document-first workspace trusted by government departments and officers.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">Get Started</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">Sign in to ERA</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <EraLogo variant="full" size="sm" href="/" />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-soft">
            <ShieldCheck className="h-3.5 w-3.5" /> Your workspace is private · © 2026 ERA
          </p>
        </div>
      </footer>
    </div>
  );
}

function cnGlyph(grad: string) {
  return `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${grad}`;
}
