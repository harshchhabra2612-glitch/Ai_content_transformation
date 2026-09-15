import { useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  FileQuestion,
  FileUp,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Search,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea, badgeTone } from "../components/ui";
import { HELP_FAQ, helpTopics } from "../data/mock";
import { useToast } from "../context/ToastContext";
import { cn } from "../utils/cn";

const TOPIC_ICONS: Record<string, typeof CircleHelp> = {
  "get-started": CircleHelp,
  upload: FileUp,
  transform: MessageSquareText,
  generate: Sparkles,
  files: FileQuestion,
  "linkedin-preview": Share2,
  "linkedin-story": Share2,
  "twitter-preview": Share2,
  account: ShieldCheck,
};

const TOPIC_BODY: Record<string, string[]> = {
  "get-started": [
    "ERA is a file-first transformation workspace for government teams.",
    "Sign in, complete your government workspace setup, then upload a document from the Dashboard.",
    "Follow the workspace steps: Choose Work → Configure → Generate → Preview.",
  ],
  upload: [
    "ERA supports PDF, DOCX, PPTX, XLSX and TXT files up to 25 MB each.",
    "You can add multiple files and remove them from the list before continuing.",
    "Drag and drop files anywhere on the upload zone, or use the + Add files button.",
  ],
  transform: [
    "After uploading, select Continue to Choose Work to open the dedicated Choose Work tab.",
    "Pick from 13 work types: Summarize, Executive Brief, Government Report, Presentation, Meeting Notes, Action Items, Email, FAQ, Rewrite, Extract Key Points, LinkedIn Post, LinkedIn Story and Twitter/X Post.",
    "Translation to other languages is marked Coming Soon — ERA currently generates in English.",
  ],
  generate: [
    "In Configure, set the tone, length and audience for your output.",
    "LinkedIn Post, LinkedIn Story and Twitter/X Post show social-specific tone options.",
    "Select Generate Content and wait for the simulated generation to finish.",
  ],
  files: [
    "Open the Files page to search, filter and sort your documents.",
    "Use the More menu on any file to rename, move, download, share or delete it.",
    "Uploaded documents are also added to your workspace library.",
  ],
  "linkedin-preview": [
    "Choosing LinkedIn Post generates a professional feed-style card preview.",
    "The preview shows your post as it would appear on LinkedIn, with reactions and actions.",
    "Edit the content on the left and the preview updates in real time.",
    "Use Copy Post or Download as Image to export.",
  ],
  "linkedin-story": [
    "LinkedIn Story generates a short, engaging narrative in a portrait storytelling format.",
    "The story preview uses a visual card with Opening, Context, Impact and Looking Ahead sections.",
    "Choose a story tone such as Impact Story or Public Service Story in Configure.",
    "Editing the content updates the story preview live — use Copy Story, Download as Image or Export.",
  ],
  "twitter-preview": [
    "Twitter/X Post generates a short, professional update for a single post.",
    "The compact preview shows a realistic post card with a character counter.",
    "Keep the post within the 280-character guidance — the counter warns as you approach the limit.",
    "Use Copy Post or Download as Image to export.",
  ],
  account: [
    "Manage your profile, government department and role in Settings → Account.",
    "Review active sessions and login activity in Settings → Security.",
    "Your workspace is private. Contact support for any account issues.",
  ],
};

export default function Help() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(HELP_FAQ[0].q);
  const [topic, setTopic] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", subject: "Getting started with ERA", message: "" });

  const q = query.trim().toLowerCase();
  const filteredFaq = HELP_FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  const activeTopic = helpTopics.find((t) => t.id === topic);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="anim-slide-up relative overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-[var(--shadow-card)] sm:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15),transparent_65%)]" />
          <div className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.12),transparent_65%)]" />
        </div>
        <div className="relative max-w-2xl">
          <Badge className={badgeTone.brand}>
            <LifeBuoy className="h-3 w-3" /> Help Center
          </Badge>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">How can we help?</h1>
          <p className="mt-2 text-[15px] text-mute">Guides, FAQs and support for getting the most out of ERA.</p>
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help articles and FAQs…"
              aria-label="Search help"
              className="focus-ring h-12 w-full rounded-xl border border-line bg-s2/60 pr-4 pl-11 text-[15px] text-ink placeholder:text-soft transition-colors focus:border-brand"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Topics */}
        <div className="space-y-5 lg:col-span-1">
          <Card className="p-4">
            <h2 className="px-2 pb-2 text-[13px] font-bold tracking-wide text-soft uppercase">Browse topics</h2>
            <div className="space-y-1">
              {helpTopics.map((t) => {
                const Icon = TOPIC_ICONS[t.id] ?? CircleHelp;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTopic(topic === t.id ? null : t.id)}
                    className={cn(
                      "focus-ring w-full rounded-xl border p-3.5 text-left transition",
                      topic === t.id ? "border-brand bg-brandsoft/50" : "border-transparent hover:bg-s2"
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <Icon className="h-4 w-4 text-brand" />
                      {t.title}
                    </p>
                    <p className="mt-1 pl-6 text-[12.5px] leading-relaxed text-mute">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="anim-slide-up p-5">
            <h2 className="text-sm font-bold text-ink">Still need help?</h2>
            <p className="mt-1 text-[13px] text-mute">Our team responds to government department queries within one business day.</p>
            <Button variant="primary" className="mt-4 w-full" onClick={() => setTopic("contact")}>
              <Mail className="h-4 w-4" /> Contact Support
            </Button>
          </Card>
        </div>

        {/* Content */}
        <div className="space-y-5 lg:col-span-2">
          {topic === "contact" ? (
            <Card className="anim-fade p-5 sm:p-6">
              <button onClick={() => setTopic(null)} className="mb-3 text-[13px] font-semibold text-brandink hover:underline">← All topics</button>
              <h2 className="text-lg font-extrabold text-ink">Contact Support</h2>
              <p className="mt-1 text-sm text-mute">Tell us how we can help — we reply within one business day.</p>
              <div className="mt-5 space-y-4 rounded-2xl border border-line p-5">
                <Field label="Work email">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@department.gov.in" />
                </Field>
                <Field label="Subject">
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </Field>
                <Field label="How can we help?">
                  <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Describe the issue you're facing…" />
                </Field>
                <Button
                  variant="primary"
                  disabled={!form.email.includes("@") || form.message.trim().length < 5}
                  onClick={() => toast.success("Message sent", "Our support team will reply within one business day.")}
                >
                  <Send className="h-4 w-4" /> Send message
                </Button>
              </div>
            </Card>
          ) : activeTopic ? (
            <Card className="anim-fade p-5 sm:p-6">
              <button onClick={() => setTopic(null)} className="mb-3 text-[13px] font-semibold text-brandink hover:underline">← All topics</button>
              <div className="flex items-center gap-2.5">
                <Settings2 className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-extrabold text-ink">{activeTopic.title}</h2>
              </div>
              <p className="mt-1 text-sm text-mute">{activeTopic.description}</p>
              <div className="mt-5 space-y-3 rounded-2xl border border-line bg-s2/40 p-5">
                {TOPIC_BODY[activeTopic.id]?.map((line, i) => (
                  <p key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-mute">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-soft">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Your workspace is private · Built for professional government workflows
              </div>
            </Card>
          ) : filteredFaq.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No help articles found"
                description={`Nothing matched "${query}". Try different keywords or contact support.`}
                action={
                  <Button variant="primary" onClick={() => { setQuery(""); setTopic("contact"); }}>
                    Contact Support
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <CircleHelp className="h-5 w-5 text-brand" />
                <h2 className="text-[16px] font-extrabold text-ink">Frequently asked questions</h2>
              </div>
              <div className="divide-y divide-line">
                {filteredFaq.map((f) => (
                  <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === f.q} onToggle={() => setOpenFaq(openFaq === f.q ? null : f.q)} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} className="focus-ring flex w-full items-center justify-between gap-3 rounded-xl px-1 py-3 text-left">
        <span className="text-[14px] font-bold text-ink">{q}</span>
        <ChevronDown className={cn("h-4.5 w-4.5 shrink-0 text-soft transition-transform duration-200", open && "rotate-180 text-brand")} />
      </button>
      {open && <p className="anim-fade px-1 pb-4 text-sm leading-relaxed text-mute">{a}</p>}
    </div>
  );
}
