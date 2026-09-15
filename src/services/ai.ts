import type { AudienceId, LengthId, PresentationSlide, StructuredMeetingNotes, ToneId, TransformationId, User } from "../types";

export interface AIConfig {
  transformation: TransformationId;
  tone: ToneId;
  length: LengthId;
  audience: AudienceId;
  fileName?: string;
  user?: User | null;
}

export const GENERATION_STEPS = [
  "Analyzing document…",
  "Understanding key information…",
  "Creating content…",
  "Formatting output…",
  "Preparing preview…",
];

export const SOURCE_PREVIEW = `This document provides a status overview of the programme for the current reporting period.

1. Progress — Core milestones are progressing according to schedule. Eleven of thirteen work streams have met their quarterly commitments, and resource utilisation remains within the planned limits.

2. Budget — Expenditure stands at 71% of the allocated budget, with a projected year-end position of 92%. A contingency reserve of 8% remains available for approved use.

3. Risks — Two operational risks require management attention: external vendor onboarding and the sequencing of the data migration. Both have identified owners and mitigation plans.

4. Stakeholders — Beneficiary feedback improved by 12% compared with the previous cycle, and inter-departmental coordination has strengthened following the adoption of standardised reporting.

5. Next steps — Phase-two rollout is scheduled to begin in the next quarter, subject to approval of the revised schedule at the governance meeting.`;

export function generateTitle(t: TransformationId, fileName?: string): string {
  const base = fileName ? fileName.replace(/\.[^.]+$/, "") : "Source Document";
  const map: Record<TransformationId, string> = {
    summarize: `Summary — ${base}`,
    "executive-brief": `Executive Brief — ${base}`,
    "government-report": `Government Report — ${base}`,
    presentation: `Presentation — ${base}`,
    "meeting-notes": `Meeting Notes — ${base}`,
    "action-items": `Action Items — ${base}`,
    email: `Email — ${base}`,
    faq: `FAQ — ${base}`,
    rewrite: `Rewritten Version — ${base}`,
    extract: `Key Points — ${base}`,
    linkedin: `LinkedIn Post — ${base}`,
    "linkedin-story": `LinkedIn Story — ${base}`,
    twitter: `Twitter/X Post — ${base}`,
    "photo-generation": `Photo Generation — ${base}`,
    "video-generation": `Video Generation — ${base}`,
  };
  return map[t];
}

/** Platform-aware generation steps shown while simulating */
export function generationStepsFor(work: TransformationId): string[] {
  const creating =
    work === "linkedin"
      ? "Creating LinkedIn post…"
      : work === "linkedin-story"
        ? "Creating LinkedIn story…"
        : work === "twitter"
          ? "Creating Twitter/X post…"
          : work === "photo-generation"
            ? "Rendering AI photo concepts & visual prompt setup…"
            : work === "video-generation"
              ? "Synthesizing 10-second video motion concept prompt…"
              : "Creating content…";
  return [
    "Analyzing document…",
    "Understanding key information…",
    creating,
    "Formatting output…",
    "Preparing preview…",
  ];
}

/** Structured Meeting Notes generator */
export function generateStructuredMeetingNotes(fileName?: string, user?: User | null): StructuredMeetingNotes {
  const docTitle = fileName ? fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") : "Document Review";
  const creatorName = user?.name || "Authenticated User";
  const now = new Date();
  const createdDateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const createdTimeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return {
    transformation: "meeting_notes",
    title: docTitle,
    meeting_date: "Not specified in source document.",
    meeting_time: "Not specified in source document.",
    overview: `Review of guidelines, requirements, and provisions specified in ${fileName || "the source document"}.`,
    agenda: [
      `Review of ${docTitle}`,
      "Key Requirements & Guidelines",
      "Implementation & Compliance",
    ],
    discussion_points: [
      `Presented core provisions established in ${fileName || "source document"}.`,
      "Reviewed compliance procedures and organizational responsibilities.",
    ],
    decisions: [
      `Approved adoption of directives outlined in ${fileName || "source document"}.`,
    ],
    action_items: [
      { task: `Review provisions of ${docTitle}`, owner: "Designated Lead", due_date: "TBD", status: "pending" },
    ],
    next_steps: [
      "Distribute guidelines to relevant team members.",
    ],
    created_by: creatorName,
    created_at: `${createdDateStr} · ${createdTimeStr}`,
    source_filename: fileName || "document.pdf",
  };
}

/** Structured Presentation Slide Generator with split limits */
export function generatePresentationSlides(_fileName?: string): PresentationSlide[] {
  return [];
}

export interface Generated {
  title: string;
  content: string;
  structuredData?: any;
}

export function generateOutput(cfg: AIConfig, _variant = 0): Generated {
  const { transformation, fileName, user } = cfg;
  const title = generateTitle(transformation, fileName);

  if (transformation === "meeting-notes") {
    const meetingData = generateStructuredMeetingNotes(fileName, user);
    return {
      title,
      content: JSON.stringify(meetingData, null, 2),
      structuredData: meetingData,
    };
  }

  if (transformation === "presentation") {
    return {
      title,
      content: JSON.stringify({
        transformation: "presentation",
        title,
        error: "No relevant document content was retrieved for this presentation.",
        slides: [],
      }),
    };
  }

  return {
    title,
    content: `Unable to generate this transformation from the selected document.`,
  };
}

/** Convert markdown-ish content to plain text (for clipboard / plain copy) */
export function contentToPlain(md: string): string {
  if (!md) return "";
  if (md.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(md);
      if (parsed.overview) {
        return `${parsed.title}\n\nOverview:\n${parsed.overview}\n\nAgenda:\n${(parsed.agenda || []).join("\n")}\n\nDecisions:\n${(parsed.decisions || []).join("\n")}`;
      }
    } catch {
      /* ignore */
    }
  }
  return md
    .split("\n")
    .map((l) => {
      const t = l.trim();
      if (t.startsWith("## ") || t.startsWith("### ")) return t.replace(/^#+\s+/, "");
      if (t === "---") return "";
      return l.replace(/\*\*/g, "").replace(/\*/g, "").trim();
    })
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

