import { BarChart2, Bookmark, ChevronLeft, ChevronRight, Globe, Heart, Info, Maximize, MessageCircle, Minimize, MoreHorizontal, Moon, Palette, Repeat2, Send, Share2, Sun, ThumbsUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "../utils/cn";
import { mdToHtml, parsePost } from "../utils/markdown";
import type { TransformationId, PresentationSlide, PresentationThemeId, PresentationThemeMode } from "../types";
import { LinkedInMark, XMark } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { DocumentMetaHeader } from "./DocumentMetaHeader";
import { formatExactDateTime } from "../utils/date";
import PresentationRenderer from "./PresentationRenderer";
import MeetingNotesRenderer from "./MeetingNotesRenderer";
import ImageGenerationPanel from "./media/ImageGenerationPanel";
import VideoGenerationPanel from "./media/VideoGenerationPanel";


function handleize(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "");
  return compact || "yourhandle";
}

/* ------------------------------ LinkedIn preview ---------------------------- */

export function LinkedInPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title;
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  const blocks = parsePost(content);
  const name = creatorName;
  const org = user?.org || "Department / Organization";

  return (
    <div className="w-full max-w-[580px] space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="LinkedIn Post"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />

      <div className="rounded-xl border border-line bg-surface text-ink shadow-card overflow-hidden">
        <div className="flex items-start gap-3 p-4 border-b border-line bg-s2/40">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a66c2] to-[#0e8fe0] text-white">
            <LinkedInMark className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              {name}
              <span className="rounded bg-s2 px-1 text-[10px] font-medium text-mute">1st</span>
            </p>
            <p className="text-[12px] text-mute">{org}</p>
            <p className="flex items-center gap-1 text-[12px] text-mute">
              <Globe className="h-3 w-3" /> Preview · <span aria-hidden>🌐</span>
            </p>
          </div>
          <button className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#0a66c2] transition hover:bg-[#e8f0fe]">
            + Follow
          </button>
        </div>

        <div className="px-4 py-3 text-[14px] leading-[1.6] text-ink">
          {blocks.map((b, i) => {
            if (b.type === "bullet") {
              return (
                <p key={i} className="mt-1 pl-1 flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0a66c2]" />
                  <span>{b.text}</span>
                </p>
              );
            }
            if (b.type === "hashtag") {
              return (
                <p key={i} className="mt-2 text-[#0a66c2] font-semibold">
                  {b.text}
                </p>
              );
            }
            return (
              <p key={i} className="mt-1.5">
                {b.text}
              </p>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[12px] font-medium text-mute">
          <span>Ready to publish on LinkedIn</span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-line border-t border-line text-[13px] font-medium text-mute">
          {[
            { icon: ThumbsUp, label: "Like" },
            { icon: MessageCircle, label: "Comment" },
            { icon: Repeat2, label: "Repost" },
            { icon: Send, label: "Send" },
          ].map((a) => (
            <button key={a.label} className="flex items-center justify-center gap-1.5 py-2.5 transition hover:bg-s2 hover:text-[#0a66c2] cursor-pointer">
              <a.icon className="h-4 w-4" /> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Twitter/X preview --------------------------- */

export function TwitterPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title;
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  // Clean preamble & enforce strict <= 280 length limit
  const rawText = content.replace(/^##[^\n]*\n\n?/, "").trim();
  const cleanText = rawText.length > 280 ? rawText.slice(0, 277) + "..." : rawText;
  const charCount = cleanText.length;
  const LIMIT = 280;
  const near = charCount >= 240;
  const counterColor = near ? "#f7b928" : "#1d9bf0";

  const name = creatorName;
  const handle = handleize(name);
  const blocks = parsePost(cleanText);

  return (
    <div className="w-full max-w-[598px] space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="X Post"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />

      <div className="overflow-hidden rounded-2xl border border-[#2f3336] bg-black text-[#e7e9ea] shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#111] to-[#333] ring-1 ring-[#2f3336]">
            <XMark className="h-5.5 w-5.5 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[15px] font-bold text-[#e7e9ea]">
              {name}
            </p>
            <p className="text-[13px] text-[#71767b]">@{handle} · Preview</p>
          </div>
          <button className="rounded-full border border-[#536471] px-4 py-1 text-[13px] font-bold text-[#eff3f4] transition hover:bg-[#181818]">
            Follow
          </button>
        </div>
        <div className="px-4 pb-3 text-[15px] leading-[1.5] text-[#e7e9ea]">
          {blocks.map((b, i) => {
            if (b.type === "bullet")
              return (
                <p key={i} className="mt-1">
                  <span className="mr-1 text-[#71767b]">•</span>
                  {b.text}
                </p>
              );
            if (b.type === "hashtag")
              return (
                <p key={i} className="mt-1.5 text-[#1d9bf0]">
                  {b.text}
                </p>
              );
            return (
              <p key={i} className="mt-1">
                {b.text}
              </p>
            );
          })}
          <p className="mt-3 flex items-center gap-2 text-[13px]">
            <span className="font-bold font-mono" style={{ color: counterColor }}>
              {charCount} / {LIMIT}
            </span>
            <span className="text-[#71767b]">
              {charCount >= 240 ? "· nearing character limit" : "characters (280 max)"}
            </span>
          </p>
        </div>
        <div className="mx-4 mb-3 flex max-w-md items-center justify-between text-[13px] text-[#71767b]">
          {[
            { icon: MessageCircle, count: "0" },
            { icon: Repeat2, count: "0" },
            { icon: Heart, count: "0" },
            { icon: BarChart2, count: "0" },
          ].map((m, i) => (
            <button key={i} className="flex items-center gap-2 rounded-full px-2 py-1 transition hover:text-[#1d9bf0]">
              <m.icon className="h-[17px] w-[17px]" /> {m.count}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <button className="rounded-full p-2 transition hover:bg-[#181818] hover:text-[#1d9bf0]">
              <Bookmark className="h-[17px] w-[17px]" />
            </button>
            <button className="rounded-full p-2 transition hover:bg-[#181818] hover:text-[#1d9bf0]">
              <Share2 className="h-[17px] w-[17px]" />
            </button>
            <button className="rounded-full p-2 transition hover:bg-[#181818]">
              <MoreHorizontal className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- LinkedIn Story preview ------------------------ */

export interface LinkedInStoryItem {
  id: string;
  category?: string;
  title?: string;
  body: string;
  bullets?: string[];
  highlight?: string;
  cta?: string;
}

export interface StorySection {
  title?: string;
  lines: string[];
}

function cleanMarkdownText(str: string): string {
  if (!str) return "";
  return str
    .replace(/^["“']|["”']$/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s*/, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^["“']|["”']$/g, "")
    .trim();
}

export function parseLinkedInStory(content: string): { stories: LinkedInStoryItem[]; hashtags: string } {
  if (!content || !content.trim()) {
    return { stories: [], hashtags: "" };
  }

  let text = content.trim();

  let hashtags = "";
  const hashtagMatches = text.match(/#[\w\d_-]+/g);
  if (hashtagMatches) {
    hashtags = Array.from(new Set(hashtagMatches)).join(" ");
  }

  // Clean preambles & intro scaffolding
  const PREAMBLE_PATTERNS = [
    /^Here is (?:the|a) [^\n]+(?:narrative|story|presentation|summary)?[^\n]*:\s*/i,
    /^Based on (?:the|your|all|provided) document[^\n]*:\s*/i,
    /^Here are the requested [^\n]*:\s*/i,
    /^(?:Certainly|Sure|Here's|Below is)[^\n]*:\s*/i,
  ];

  for (const pattern of PREAMBLE_PATTERNS) {
    text = text.replace(pattern, "").trim();
  }

  const rawLines = text.split("\n");
  const cleanLines: string[] = [];

  for (const raw of rawLines) {
    let t = raw.trim();
    if (!t) continue;

    if (
      /^(?:Here is|Based on the provided|Below is a|I have created|Here are the)/i.test(t) &&
      !/^Slide/i.test(t) &&
      !/^Story/i.test(t)
    ) {
      continue;
    }

    if (/^#(?:[\w\d_-]+\s*)+$/.test(t)) {
      continue;
    }

    cleanLines.push(t);
  }

  const rawCleanText = cleanLines.join("\n");
  const SLIDE_HEADER_REGEX = /^(?:#{1,4}\s*)?(?:\*\*)?(?:Slide|Story|Card)\s+(\d+)[\s:—\-]*([^\n]*?)(?:\*\*)?$/i;
  const hasSlideMarkers = cleanLines.some((l) => SLIDE_HEADER_REGEX.test(l));

  const rawBlocks: { title?: string; lines: string[] }[] = [];

  if (hasSlideMarkers) {
    let currentBlock: { title?: string; lines: string[] } | null = null;

    for (const line of cleanLines) {
      const match = line.match(SLIDE_HEADER_REGEX);
      if (match) {
        if (currentBlock && (currentBlock.title || currentBlock.lines.length > 0)) {
          rawBlocks.push(currentBlock);
        }
        let titlePart = match[2]?.trim() || "";
        titlePart = cleanMarkdownText(titlePart);
        currentBlock = { title: titlePart || undefined, lines: [] };
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      } else {
        currentBlock = { lines: [line] };
      }
    }
    if (currentBlock && (currentBlock.title || currentBlock.lines.length > 0)) {
      rawBlocks.push(currentBlock);
    }
  } else {
    const paragraphs = rawCleanText.split(/\n\s*\n/);
    paragraphs.forEach((p) => {
      const pLines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      if (pLines.length > 0) {
        const firstLine = pLines[0];
        const numMatch = firstLine.match(/^(?:\d+[\.\)]|\#+)\s+(.+)$/);
        let title: string | undefined = undefined;
        if (numMatch) {
          title = cleanMarkdownText(numMatch[1]);
          pLines.shift();
        } else if (pLines.length > 1 && firstLine.length < 60) {
          title = cleanMarkdownText(firstLine);
          pLines.shift();
        }
        if (pLines.length > 0 || title) {
          rawBlocks.push({ title, lines: pLines });
        }
      }
    });
  }

  const TEMPLATE_HEADERS = /^(?:Opening Hook|Key Insight \d*|Key Insight|Continue story|Context & Background|Core Learning|Key Takeaway|Call to Action|Takeaway):?\s*/i;
  const stories: LinkedInStoryItem[] = [];

  rawBlocks.forEach((block, idx) => {
    let title = block.title ? cleanMarkdownText(block.title.replace(TEMPLATE_HEADERS, "")) : undefined;
    const bodyLines: string[] = [];
    const bullets: string[] = [];
    let highlight: string | undefined = undefined;
    let cta: string | undefined = undefined;

    for (const rawLine of block.lines) {
      let l = rawLine.replace(TEMPLATE_HEADERS, "").trim();
      if (!l) continue;

      const bulletMatch = l.match(/^(?:[\-\*•]|\d+[\.\)])\s+(.+)$/);
      if (bulletMatch) {
        bullets.push(cleanMarkdownText(bulletMatch[1]));
        continue;
      }

      if (/^(?:Highlight|Key Point|Quote):?\s*(.+)$/i.test(l)) {
        const m = l.match(/^(?:Highlight|Key Point|Quote):?\s*(.+)$/i);
        if (m) highlight = cleanMarkdownText(m[1]);
        continue;
      }
      if (/^(?:CTA|Call to Action):?\s*(.+)$/i.test(l)) {
        const m = l.match(/^(?:CTA|Call to Action):?\s*(.+)$/i);
        if (m) cta = cleanMarkdownText(m[1]);
        continue;
      }

      bodyLines.push(cleanMarkdownText(l));
    }

    if (!title && bodyLines.length > 0) {
      if (bodyLines[0].length < 60) {
        title = bodyLines.shift();
      }
    }

    const bodyText = bodyLines.join("\n").trim();

    if (title || bodyText || bullets.length > 0) {
      stories.push({
        id: `story-${idx + 1}`,
        title: title || undefined,
        body: bodyText,
        bullets: bullets.length > 0 ? bullets : undefined,
        highlight,
        cta,
      });
    }
  });

  if (stories.length === 0 && text) {
    stories.push({
      id: "story-1",
      body: cleanMarkdownText(text),
    });
  }

  return { stories, hashtags };
}

export function parseStory(content: string): { sections: StorySection[]; hashtags: string } {
  const { stories, hashtags } = parseLinkedInStory(content);
  const sections: StorySection[] = stories.map((s) => ({
    title: s.title,
    lines: s.body ? s.body.split("\n") : s.bullets || [],
  }));
  return { sections, hashtags };
}

export function LinkedInStoryPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);

  const { stories, hashtags } = parseLinkedInStory(content);
  const totalSlides = stories.length;
  const currentIdx = Math.min(activeSlide, Math.max(0, totalSlides - 1));
  const currentStory = stories[currentIdx] || { id: "story-1", body: content };

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title;
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  const profileName = user?.org || user?.name || creatorName || "LinkedIn Member";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setActiveSlide((prev) => Math.min(totalSlides - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSlides]);

  return (
    <div className="w-full max-w-[420px] space-y-4 text-left mx-auto flex flex-col items-center">
      {/* 1. Compact Metadata Header */}
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="LinkedIn Story"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
        compact={true}
        className="w-full"
      />

      {/* 2. Story Canvas (Fixed 9:16 vertical portrait format) */}
      <div className="w-full aspect-[9/16] rounded-[24px] text-white shadow-2xl transition-all border border-indigo-500/20 overflow-hidden flex flex-col justify-between select-none relative bg-gradient-to-br from-[#0b0f19] via-[#1e1b4b] to-[#312e81]">
        {/* Subtle decorative glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.25),transparent_60%)] pointer-events-none" />

        {/* Top Header Region (Progress bars + Profile header) */}
        <div className="relative z-10 space-y-2.5 pt-3.5 px-4.5">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {stories.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  i === currentIdx
                    ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    : i < currentIdx
                    ? "bg-white/70"
                    : "bg-white/20"
                )}
              />
            ))}
          </div>

          {/* Profile Header */}
          <div className="flex items-center gap-3 pt-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md">
              <LinkedInMark className="h-4.5 w-4.5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-white leading-tight">{profileName}</p>
              <p className="text-[11px] text-white/70 font-medium">LinkedIn Story</p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10.5px] font-bold text-indigo-200 border border-white/15">
              {currentIdx + 1} / {totalSlides}
            </span>
          </div>
        </div>

        {/* Story Canvas Main Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-5 overflow-y-auto no-scrollbar">
          <div className="space-y-3.5 my-auto">
            {currentStory.title && (
              <h3 className="text-[19px] sm:text-[21px] font-extrabold leading-snug tracking-tight text-white drop-shadow-sm">
                {currentStory.title}
              </h3>
            )}

            {currentStory.body && (
              <div className="space-y-2.5 text-[13.5px] sm:text-[14px] leading-relaxed text-white/95 font-normal">
                {currentStory.body.split("\n").map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            )}

            {currentStory.bullets && currentStory.bullets.length > 0 && (
              <div className="space-y-2 pt-1">
                {currentStory.bullets.map((bullet, j) => (
                  <div key={j} className="flex items-start gap-2.5 text-[13.5px] text-white/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300 shadow-sm" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            )}

            {currentStory.highlight && (
              <div className="mt-3 rounded-xl bg-white/10 p-3 border border-white/15 text-[12.5px] font-medium leading-snug text-indigo-100 backdrop-blur-md">
                💡 {currentStory.highlight}
              </div>
            )}

            {currentStory.cta && (
              <div className="mt-3 inline-block rounded-full bg-white/20 px-3.5 py-1.5 text-[11.5px] font-bold text-white border border-white/30 backdrop-blur-md">
                {currentStory.cta}
              </div>
            )}
          </div>

          {hashtags && (
            <p className="mt-3 text-[11px] font-semibold text-indigo-200 truncate border-t border-white/10 pt-2">
              {hashtags}
            </p>
          )}
        </div>

        {/* Story Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 px-5 py-2.5 bg-black/20 text-[10.5px] font-semibold text-white/60">
          <span>LinkedIn Professional Story</span>
          <span>Tap arrows to navigate</span>
        </div>
      </div>

      {/* 3. Navigation Controls OUTSIDE and BELOW the Canvas */}
      <div className="flex items-center justify-between w-full max-w-[380px] pt-1">
        <button
          onClick={() => setActiveSlide((prev) => Math.max(0, prev - 1))}
          disabled={currentIdx === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer",
            currentIdx === 0
              ? "opacity-40 cursor-not-allowed border border-line bg-s2 text-mute"
              : "border border-line bg-surface text-ink hover:border-brand hover:text-brand shadow-sm"
          )}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        <span className="text-xs font-extrabold tracking-wider text-mute">
          Story {currentIdx + 1} of {totalSlides}
        </span>

        <button
          onClick={() => setActiveSlide((prev) => Math.min(totalSlides - 1, prev + 1))}
          disabled={currentIdx === totalSlides - 1}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer",
            currentIdx === totalSlides - 1
              ? "opacity-40 cursor-not-allowed border border-line bg-s2 text-mute"
              : "bg-brand text-white shadow-sm hover:bg-brand/90"
          )}
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Email style preview --------------------------- */

export function EmailPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();
  const subject = content.match(/^Subject:\s*(.+)/m)?.[1] ?? content.match(/\*\*Subject:\*\*\s*(.+)/)?.[1] ?? "Document Update & Guidance";
  
  const bodyText = content
    .replace(/^Subject:[^\n]*\n?/m, "")
    .replace(/\*\*Subject:\*\*[^\n]*\n?/, "")
    .replace(/^##[^\n]*\n/, "")
    .trim();

  const bodyHtml = mdToHtml(bodyText);

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title;
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  const fromName = creatorName;
  const fromInitials = fromName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="w-full max-w-[680px] space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="Email Draft"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />

      <div className="overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-card">
        <div className="flex items-center gap-3 border-b border-line bg-s2/60 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[13px] font-bold text-white">
            {fromInitials}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[13px] font-semibold">{fromName}</p>
            <p className="truncate text-[11.5px] text-mute">Draft — Recipient not set</p>
          </div>
          <span className="text-[11px] font-semibold text-brand bg-brandsoft px-2 py-0.5 rounded">Email Draft</span>
        </div>
        <div className="border-b border-line px-4 py-3 text-left bg-s2/30">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-mute block">Subject</span>
          <p className="text-[15px] font-bold text-ink mt-0.5">{subject}</p>
        </div>
        <div className="px-5 py-4 text-left">
          <div className="output-editor text-ink" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          <p className="mt-5 border-t border-line pt-3 text-[11px] text-mute">This email draft was generated by ERA from the source document.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Slide preview ------------------------------ */

export function parsePresentation(content: string): PresentationSlide[] {
  if (!content || !content.trim()) return [];

  const trimmed = content.trim();

  // 1. Check if content is JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawSlides = Array.isArray(parsed) ? parsed : parsed.slides || parsed.data || [];
      if (Array.isArray(rawSlides) && rawSlides.length > 0) {
        return rawSlides.map((s: any, idx: number) => ({
          slide_number: Number(s.slide_number || s.slideNumber || idx + 1),
          title: String(s.title || s.slideTitle || `Slide ${idx + 1}`),
          subtitle: s.subtitle ? String(s.subtitle) : undefined,
          bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : Array.isArray(s.points) ? s.points.map(String) : undefined,
          body: s.body || s.content ? String(s.body || s.content) : undefined,
        }));
      }
    } catch {
      // Fallback
    }
  }

  // 2. Text/Markdown parsing
  const slides: PresentationSlide[] = [];
  const lines = trimmed.split("\n");

  const SLIDE_HEADER_PATTERN = /^(?:#{1,4}\s*)?(?:\*\*)?(?:Slide\s+\d+|Slide\s+Card\s+\d+)(?:[\s:—\-]*)(.*?)(?:\*\*)?$/i;
  const HEADER_SECTION_PATTERN = /^(?:#{1,3}\s+)(.*?)$/;
  const HR_PATTERN = /^---+\s*$/;

  const hasSlideMarkers = lines.some((l) => SLIDE_HEADER_PATTERN.test(l.trim()));

  interface RawBlock {
    headerTitle?: string;
    lines: string[];
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    let isHeader = false;
    let headerTitle = "";

    if (hasSlideMarkers) {
      const match = line.match(SLIDE_HEADER_PATTERN);
      if (match) {
        isHeader = true;
        headerTitle = match[1] ? match[1].trim() : "";
      }
    } else if (HR_PATTERN.test(line)) {
      isHeader = true;
      headerTitle = "";
    } else if (HEADER_SECTION_PATTERN.test(line)) {
      const match = line.match(HEADER_SECTION_PATTERN);
      isHeader = true;
      headerTitle = match ? match[1].trim() : "";
    }

    if (isHeader) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = { headerTitle, lines: [] };
    } else {
      if (!currentBlock) {
        currentBlock = { headerTitle: "", lines: [] };
      }
      if (line) {
        currentBlock.lines.push(line);
      }
    }
  }
  if (currentBlock && (currentBlock.headerTitle || currentBlock.lines.length > 0)) {
    blocks.push(currentBlock);
  }

  blocks.forEach((block, idx) => {
    let title = block.headerTitle;
    let subtitle: string | undefined = undefined;
    const bullets: string[] = [];
    const bodyLines: string[] = [];

    for (const l of block.lines) {
      const titleMatch = l.match(/^(?:\*\*)?Title[:\s]+(?:\*\*)?["“]?(.*?)["”]?$/i);
      const subMatch = l.match(/^(?:\*\*)?Subtitle[:\s]+(?:\*\*)?["“]?(.*?)["”]?$/i);
      const bulletMatch = l.match(/^(?:[\-\*•]|\d+[\.\)])\s+(.+)$/);

      if (titleMatch && !title) {
        title = titleMatch[1].trim();
      } else if (subMatch && !subtitle) {
        subtitle = subMatch[1].trim();
      } else if (bulletMatch) {
        const item = bulletMatch[1].trim();
        if (item) bullets.push(item);
      } else if (!/^(?:\*\*)?(?:Key Takeaways|Bullets|Overview|Takeaways)[:\s]*/i.test(l)) {
        bodyLines.push(l);
      }
    }

    if (title) {
      title = title.replace(/^["“']|["”']$/g, "").replace(/^\*\*|\*\*$/g, "").trim();
    }
    if (subtitle) {
      subtitle = subtitle.replace(/^["“']|["”']$/g, "").replace(/^\*\*|\*\*$/g, "").trim();
    }

    if (!title) {
      if (bodyLines.length > 0 && bodyLines[0].length < 60) {
        title = bodyLines.shift()!.replace(/^\*\*|\*\*$/g, "").trim();
      } else {
        title = `Slide ${idx + 1}`;
      }
    }

    const bodyText = bodyLines.join("\n").trim();

    slides.push({
      slide_number: idx + 1,
      title,
      subtitle: subtitle || undefined,
      bullets: bullets.length > 0 ? bullets : undefined,
      body: bodyText || undefined,
    });
  });

  if (slides.length === 0 && trimmed) {
    slides.push({
      slide_number: 1,
      title: "Presentation Overview",
      body: trimmed,
    });
  }

  return slides;
}

export function SlidePreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [theme, setTheme] = useState<PresentationThemeId>("modern");
  const [mode, setMode] = useState<PresentationThemeMode>("light");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceFilename = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdStr = formatExactDateTime(generated?.createdAt || primaryFile?.createdAt || new Date().toISOString());

  let backendError: string | null = null;
  if (content && content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.error) backendError = parsed.error;
    } catch {}
  }

  const slides = parsePresentation(content);
  const totalSlides = slides.length;
  const activeIndex = Math.min(currentSlideIndex, Math.max(0, totalSlides - 1));

  useEffect(() => {
    console.log("==================== [DEBUG 7: RENDERED SLIDES] ====================");
    console.log("Total slides:", totalSlides);
    console.log("Slides payload:", slides);
    console.log("====================================================================");
  }, [slides, totalSlides]);

  // Extract embedded theme from JSON if present
  useEffect(() => {
    if (content && content.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.theme && ["modern", "corporate", "academic", "government", "gradient"].includes(parsed.theme)) {
          setTheme(parsed.theme as PresentationThemeId);
        }
        if (parsed.mode && ["light", "dark"].includes(parsed.mode)) {
          setMode(parsed.mode as PresentationThemeMode);
        }
      } catch {
        /* ignore */
      }
    }
  }, [content]);

  // Keyboard navigation (ArrowLeft / ArrowRight) & Fullscreen listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentSlideIndex((prev) => Math.min(totalSlides - 1, prev + 1));
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [totalSlides]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  if (backendError) {
    return (
      <div className="flex h-64 w-full max-w-3xl flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center">
        <p className="text-sm font-bold text-red-600">{backendError}</p>
        <p className="mt-1 text-xs text-red-500">Ensure your uploaded document contains text content before generating a presentation.</p>
      </div>
    );
  }

  if (!content || !content.trim()) {
    return (
      <div className="flex h-64 w-full max-w-3xl flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 p-6 text-center">
        <p className="text-sm font-semibold text-mute">No presentation content available.</p>
        <p className="mt-1 text-xs text-soft">Generate a presentation transformation to view slides here.</p>
      </div>
    );
  }

  if (totalSlides === 0) {
    return (
      <div className="flex h-64 w-full max-w-3xl flex-col items-center justify-center rounded-2xl border border-line bg-surface/40 p-6 text-center">
        <p className="text-sm font-semibold text-danger">No slides generated for this presentation.</p>
        <p className="mt-1 text-xs text-mute">Check the backend logs for details.</p>
      </div>
    );
  }

  const slide = slides[activeIndex];

  const themeOptions: { id: PresentationThemeId; label: string }[] = [
    { id: "modern", label: "Modern" },
    { id: "corporate", label: "Corporate" },
    { id: "academic", label: "Academic" },
    { id: "government", label: "Government" },
    { id: "gradient", label: "Gradient / Creative" },
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full max-w-3xl space-y-4 transition-all duration-300 relative",
        isFullscreen && "fixed inset-0 z-50 flex max-w-none flex-col justify-between bg-slate-950 p-6 sm:p-10"
      )}
    >
      {/* Presentation Metadata Header Panel */}
      {!isFullscreen && (
        <DocumentMetaHeader
          docTitle={generated?.source?.title || primaryFile?.title}
          filename={sourceFilename}
          transformationLabel="Presentation"
          creator={{ name: creatorName }}
          createdAt={generated?.createdAt || primaryFile?.createdAt}
          updatedAt={generated?.updatedAt}
        />
      )}

      {/* Studio Header Toolbar (Theme Selector + Light/Dark Mode + Fullscreen Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand" />
            <span className="text-xs font-bold text-ink">Theme:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as PresentationThemeId)}
              className="rounded-lg border border-line bg-s2/60 px-2.5 py-1 text-xs font-semibold text-ink focus:border-brand focus:outline-none cursor-pointer"
            >
              {themeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-s2 px-3 py-1 text-xs font-bold text-ink transition hover:border-brand hover:text-brand cursor-pointer"
          >
            {mode === "light" ? (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-600" /> Dark Mode
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" /> Light Mode
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isFullscreen && (
            <div className="relative">
              <button
                onClick={() => setShowInfo((prev) => !prev)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
                title="Show presentation metadata"
              >
                <Info className="h-4 w-4" />
              </button>

              {showInfo && (
                <div className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-white/20 bg-slate-900/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md">
                  <p className="font-extrabold text-cyan-400 uppercase tracking-wider text-[10px]">PRESENTATION METADATA</p>
                  <p className="mt-1.5 text-slate-300">Source: <span className="font-semibold text-white font-mono">{sourceFilename}</span></p>
                  <p className="mt-1 text-slate-300">Created by: <span className="font-semibold text-white">{creatorName}</span></p>
                  <p className="mt-1 text-slate-300">Created: <span className="font-semibold text-white">{createdStr}</span></p>
                  <p className="mt-1 text-slate-300">Slides: <span className="font-semibold text-white">{totalSlides}</span> · <span className="capitalize">{theme} ({mode})</span></p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-s2 px-3 py-1 text-xs font-bold text-ink transition hover:border-brand hover:text-brand cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize className="h-3.5 w-3.5" /> Exit Fullscreen (Esc)
              </>
            ) : (
              <>
                <Maximize className="h-3.5 w-3.5" /> Fullscreen Mode
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 16:9 Presentation Canvas */}
      <div className={cn("relative w-full", isFullscreen && "my-auto max-w-5xl mx-auto")}>
        <PresentationRenderer slide={slide} theme={theme} mode={mode} totalSlides={totalSlides} activeIndex={activeIndex} />
      </div>


      {/* Horizontal Slide Thumbnails Bar */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-mute px-1">
          Slide Sequence ({totalSlides})
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
          {slides.map((s, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={cn(
                  "flex h-16 w-28 shrink-0 flex-col justify-between rounded-xl border p-2 text-left transition-all cursor-pointer overflow-hidden",
                  isActive
                    ? "border-brand bg-brandsoft/30 ring-2 ring-brand/50 shadow-md"
                    : "border-line bg-surface hover:border-line2 hover:bg-s2/60"
                )}
              >
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className={cn(isActive ? "text-brand" : "text-mute")}>#{idx + 1}</span>
                  <span className="text-[9px] uppercase text-soft">{s.layout || "slide"}</span>
                </div>
                <p className="truncate text-[10.5px] font-semibold text-ink leading-tight">
                  {s.title || `Slide ${idx + 1}`}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide Navigation Controls */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm">
        <button
          onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
          disabled={activeIndex === 0}
          className={cn(
            "flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
            activeIndex === 0
              ? "opacity-40 cursor-not-allowed text-mute"
              : "bg-s2 text-ink hover:bg-s3 hover:text-brand"
          )}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <span className="text-brand font-extrabold">{activeIndex + 1}</span>
          <span className="text-mute">/</span>
          <span>{totalSlides}</span>
        </div>

        <button
          onClick={() => setCurrentSlideIndex((prev) => Math.min(totalSlides - 1, prev + 1))}
          disabled={activeIndex === totalSlides - 1}
          className={cn(
            "flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
            activeIndex === totalSlides - 1
              ? "opacity-40 cursor-not-allowed text-mute"
              : "bg-brand text-white shadow-sm hover:bg-brand/90"
          )}
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------- Action item register --------------------------- */

function actionRows(content: string): { id: number; task: string; owner?: string; due?: string; priority?: string; status: boolean }[] {
  const rows: { id: number; task: string; owner?: string; due?: string; priority?: string; status: boolean }[] = [];
  let idx = 1;
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(?:\d+[\.\)]|\-|\*)\s+(?:\*\*)?(.+?)(?:\*\*)?(?:\s*—\s*Owner:\s*(.+?))?(?:\s*—\s*Due:\s*(.+?))?(?:\s*—\s*Priority:\s*(.+?))?$/);
    if (m) {
      rows.push({
        id: idx++,
        task: m[1].replace(/^\*\*|\*\*$/g, "").trim(),
        owner: m[2] ? m[2].trim() : undefined,
        due: m[3] ? m[3].trim() : undefined,
        priority: m[4] ? m[4].trim() : undefined,
        status: false,
      });
    }
  }
  if (rows.length === 0 && content.trim()) {
    rows.push({
      id: 1,
      task: content.trim().slice(0, 120),
      owner: "Unassigned",
      due: "TBD",
      priority: "Medium",
      status: false,
    });
  }
  return rows;
}

const priorityTone: Record<string, string> = {
  High: "bg-red-500/15 text-red-500 border border-red-500/30",
  Medium: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  Low: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
};

export function ActionItemsPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();
  const initialRows = actionRows(content);
  const [tasks, setTasks] = useState(initialRows);

  useEffect(() => {
    setTasks(actionRows(content));
  }, [content]);

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: !t.status } : t))
    );
  };

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title;
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  const completedCount = tasks.filter((t) => t.status).length;

  return (
    <div className="w-full max-w-2xl space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="Action Items"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />
      <div className="rounded-xl border border-line bg-surface text-left shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-s2/60 px-5 py-3.5">
          <div>
            <p className="text-[13px] font-bold text-ink">Action Tasks Register</p>
            <p className="text-[11px] text-mute">Actionable commitments extracted from the document</p>
          </div>
          <span className="rounded-full bg-brandsoft px-2.5 py-1 text-[11px] font-bold text-brandink">
            {completedCount} / {tasks.length} completed
          </span>
        </div>
        <div className="divide-y divide-line">
          {tasks.map((r) => (
            <div key={r.id} className="flex items-start gap-3.5 px-5 py-3.5 transition hover:bg-s2/40">
              <button
                onClick={() => toggleTask(r.id)}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition cursor-pointer",
                  r.status
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-line bg-s2 text-mute hover:border-brand"
                )}
              >
                {r.status ? "✓" : r.id}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13.5px] font-semibold transition", r.status ? "text-mute line-through opacity-70" : "text-ink")}>
                  {r.task}
                </p>
                <p className="mt-0.5 text-[11.5px] text-mute flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {r.owner && <span>Owner: <span className="font-medium text-ink">{r.owner}</span></span>}
                  {r.due && <span>Due: <span className="font-medium text-ink">{r.due}</span></span>}
                </p>
              </div>
              {r.priority && (
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider shrink-0", priorityTone[r.priority] ?? "bg-s2 text-mute")}>
                  {r.priority}
                </span>
              )}
            </div>
          ))}
          {tasks.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-mute">No open action items found in the current content.</p>}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- FAQ card preview ------------------------------ */

export function FaqPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();
  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title;
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  const qas: { q: string; a: string }[] = [];
  let curQ: string | null = null;
  const pending: string[] = [];

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    const qMatch = t.match(/^(?:###\s*)?(?:(?:\*\*)?Q\d*[:\.]?(?:\*\*)?)\s*(.+)$/i);
    const aMatch = t.match(/^(?:###\s*)?(?:(?:\*\*)?A\d*[:\.]?(?:\*\*)?)\s*(.+)$/i);

    if (qMatch) {
      if (curQ) {
        qas.push({ q: curQ, a: pending.join("\n") });
        pending.length = 0;
      }
      curQ = qMatch[1].trim();
    } else if (aMatch && curQ) {
      pending.push(aMatch[1].trim());
    } else if (curQ) {
      pending.push(t);
    }
  }
  if (curQ) {
    qas.push({ q: curQ, a: pending.join("\n") });
  }

  return (
    <div className="w-full max-w-2xl space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="Frequently Asked Questions"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />

      {qas.length > 0 ? (
        <div className="space-y-4">
          {qas.map((qa, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface text-left shadow-card">
              <div className="flex items-start gap-3 bg-s2/60 px-4 py-3 border-b border-line">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand text-[11px] font-extrabold text-white mt-0.5">
                  Q{i + 1}
                </span>
                <p className="text-[14px] font-bold text-ink leading-snug">{qa.q}</p>
              </div>
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-[11px] font-extrabold text-emerald-500 border border-emerald-500/30">
                  A
                </span>
                <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink/90 whitespace-pre-wrap">
                  {qa.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface p-6 text-left shadow-card">
          <div className="output-editor text-ink whitespace-pre-wrap text-[14px] leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------ Generic document preview -------------------------- */

export function DocumentPreview({ work, content }: { work: TransformationId; content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();
  const html = mdToHtml(content.replace(/^##[^\n]*\n?/, "").trimStart());
  const labelMap: Record<string, string> = {
    summarize: "Summary",
    "executive-brief": "Executive Brief",
    "government-report": "Government Report",
    "meeting-notes": "Meeting Notes",
    rewrite: "Rewritten Document",
    extract: "Key Points",
    key_points: "Key Points",
  };
  const meta: Record<string, { note: string }> = {
    summarize: { note: "Concise summary generated from the source document." },
    "executive-brief": { note: "Confidential — for internal use within senior leadership." },
    "government-report": { note: "Formal departmental report for official records." },
    "meeting-notes": { note: "Official meeting record." },
    rewrite: { note: "Clarity-focused rewrite of the source material." },
    extract: { note: "Essential key points extracted from the source document." },
  };
  const transformationLabel = labelMap[work] || "Document";
  const m = meta[work] ?? meta.summarize;

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title || primaryFile?.name || "";
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  return (
    <div className="w-full max-w-[760px] space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel={transformationLabel}
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface text-ink p-6 sm:p-8 shadow-card">
        <div className="output-editor text-ink" dangerouslySetInnerHTML={{ __html: html }} />
        <p className="mt-6 border-t border-line pt-3 text-[11px] text-mute">{m.note}</p>
      </div>
    </div>
  );
}

/* ------------------------------ Photo Generation preview -------------------- */

export function PhotoPreview() {
  const { sessionFiles } = useApp();
  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const docId = primaryFile?.document_id || primaryFile?.fileId || primaryFile?.id;
  const universalPrompt = "Create a professional 16:9 visual based strictly on the uploaded document, highlighting its main subject, key information, important concepts, and relevant details. Use a clean, polished, visually engaging composition with realistic lighting, strong hierarchy, and an appropriate professional style. Do not introduce information that is not supported by the document.";

  return (
    <div className="w-full max-w-[680px]">
      <ImageGenerationPanel documentId={docId} initialPrompt={universalPrompt} />
    </div>
  );
}

/* ------------------------------ Video Generation preview -------------------- */

export function VideoPreview({ content }: { content: string }) {
  const { sessionFiles } = useApp();
  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const docId = primaryFile?.document_id || primaryFile?.fileId || primaryFile?.id;

  return (
    <div className="w-full max-w-[680px]">
      <VideoGenerationPanel documentId={docId} initialPrompt={content} />
    </div>
  );
}

/* ------------------------------ Key Points Preview -------------------------- */

export function KeyPointsPreview({ content }: { content: string }) {
  const { sessionFiles, generated } = useApp();
  const { user } = useAuth();

  const rawLines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const items: string[] = [];

  for (const line of rawLines) {
    if (/^#+\s*(Key Points|Extract|Essential Key Points|Summary)/i.test(line)) {
      continue;
    }
    const cleanText = line
      .replace(/^#+\s*/, "")
      .replace(/^(?:\d+[\.\)]\s*)+/, "")
      .replace(/^[•\-*]\s*/, "")
      .trim();

    if (cleanText) {
      items.push(cleanText);
    }
  }

  const primaryFile = sessionFiles.find((f) => f.status === "ready") || sessionFiles[0];
  const sourceName = generated?.source?.filename || primaryFile?.filename || primaryFile?.name || "source_document.pdf";
  const sourceTitle = generated?.source?.title || primaryFile?.title || primaryFile?.name || "";
  const creatorName = generated?.createdBy?.name || user?.name || user?.email || "Authenticated User";
  const createdAtStr = generated?.createdAt || primaryFile?.createdAt || new Date().toISOString();
  const updatedAtStr = generated?.updatedAt;

  return (
    <div className="w-full max-w-[760px] space-y-4 text-left">
      <DocumentMetaHeader
        docTitle={sourceTitle}
        filename={sourceName}
        transformationLabel="Key Points"
        creator={{ name: creatorName }}
        createdAt={createdAtStr}
        updatedAt={updatedAtStr}
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface text-ink p-6 sm:p-8 shadow-card">
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3.5 p-3.5 rounded-xl border border-line/60 bg-s2/40 hover:bg-s2/80 transition-all duration-200"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brandsoft text-brand font-extrabold text-xs shadow-sm">
                {index + 1}
              </span>
              <span className="text-sm font-medium leading-relaxed text-ink pt-0.5">
                {item}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-line pt-3 text-[11px] text-mute">
          Essential key points extracted from the source document.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Preview picker ------------------------------ */

export function PlatformPreview({ work, content }: { work: TransformationId; content: string }) {
  const w = work as string;
  if (w === "extract" || w === "key_points" || w === "key-points") return <KeyPointsPreview content={content} />;
  if (w === "linkedin" || w === "linkedin_post") return <LinkedInPreview content={content} />;
  if (w === "linkedin-story" || w === "linkedin_story") return <LinkedInStoryPreview content={content} />;
  if (w === "twitter" || w === "twitter_post") return <TwitterPreview content={content} />;
  if (w === "photo-generation" || w === "photo_generation") return <PhotoPreview />;
  if (w === "video-generation" || w === "video_generation") return <VideoPreview content={content} />;
  if (w === "email") return <EmailPreview content={content} />;
  if (w === "presentation") return <SlidePreview content={content} />;
  if (w === "meeting-notes" || w === "meeting_notes") return <MeetingNotesRenderer rawContent={content} />;
  if (w === "action-items" || w === "action_items") return <ActionItemsPreview content={content} />;
  if (w === "faq") return <FaqPreview content={content} />;
  return <DocumentPreview work={work} content={content} />;
}

export const SOCIAL_WORKS: TransformationId[] = ["linkedin", "linkedin-story", "twitter", "photo-generation", "video-generation"];
