import type {
  AudienceId,
  LengthId,
  Preferences,
  ToneId,
  TransformationDef,
  TransformationId,
} from "../types";

/* ---------------------------------- Options --------------------------------- */

export const TRANSFORMATIONS: TransformationDef[] = [
  { id: "summarize", label: "Summarize", description: "Create a concise summary of the document." },
  { id: "executive-brief", label: "Executive Brief", description: "Create a concise brief for senior decision makers." },
  { id: "government-report", label: "Government Report", description: "Turn the document into a structured professional report." },
  { id: "presentation", label: "Presentation", description: "Create presentation-ready content." },
  { id: "meeting-notes", label: "Meeting Notes", description: "Convert content into structured meeting notes." },
  { id: "action-items", label: "Action Items", description: "Extract actionable tasks and responsibilities." },
  { id: "email", label: "Email", description: "Create a professional government email." },
  { id: "faq", label: "FAQ", description: "Create clear frequently asked questions and answers." },
  { id: "rewrite", label: "Rewrite", description: "Rewrite the content in a professional style." },
  { id: "extract", label: "Extract Key Points", description: "Extract the most important information." },
  { id: "linkedin", label: "LinkedIn Post", description: "Turn your government document into a professional LinkedIn post." },
  { id: "linkedin-story", label: "LinkedIn Story", description: "Transform your document into a short, engaging LinkedIn story-style narrative." },
  { id: "twitter", label: "Twitter/X Post", description: "Turn your document into a concise Twitter/X post." },
  { id: "photo-generation", label: "Photo Generation", description: "Generate high-quality visual concept images & media graphics." },
  { id: "video-generation", label: "Video Generation", description: "Generate 10-second cinematic video concepts & motion prompts." },
];

/** Disabled placeholder shown in Choose Work */
export const COMING_SOON_TRANSFORMATIONS: { label: string; description: string }[] = [
  { label: "Translate", description: "Translation to other languages — coming soon." },
];

export const QUICK_TRANSFORMATIONS = [
  "summarize",
  "executive-brief",
  "government-report",
  "presentation",
  "photo-generation",
  "video-generation",
  "linkedin",
  "twitter",
] as TransformationId[];

/* --------------------------- Tone / length / audience ----------------------- */

export const DOC_TONES: { id: ToneId; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "formal", label: "Formal" },
  { id: "concise", label: "Concise" },
  { id: "executive", label: "Executive" },
  { id: "informative", label: "Informative" },
];

export const LINKEDIN_TONES: { id: ToneId; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "informative", label: "Informative" },
  { id: "leadership", label: "Leadership" },
  { id: "public-announcement", label: "Public Announcement" },
];

export const LINKEDIN_STORY_TONES: { id: ToneId; label: string }[] = [
  { id: "professional-story", label: "Professional Story" },
  { id: "impact-story", label: "Impact Story" },
  { id: "leadership-story", label: "Leadership Story" },
  { id: "public-service-story", label: "Public Service Story" },
  { id: "project-story", label: "Project Story" },
];

export const TWITTER_TONES: { id: ToneId; label: string }[] = [
  { id: "concise", label: "Concise" },
  { id: "informative", label: "Informative" },
  { id: "announcement", label: "Announcement" },
  { id: "public-update", label: "Public Update" },
];

export function tonesFor(work: TransformationId): { id: ToneId; label: string }[] {
  if (work === "linkedin") return LINKEDIN_TONES;
  if (work === "linkedin-story") return LINKEDIN_STORY_TONES;
  if (work === "twitter") return TWITTER_TONES;
  return DOC_TONES;
}

export const ALL_TONES: { id: ToneId; label: string }[] = [
  ...DOC_TONES,
  ...LINKEDIN_TONES,
  ...LINKEDIN_STORY_TONES,
  ...TWITTER_TONES,
].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);

export const LENGTHS: { id: LengthId; label: string; hint: string }[] = [
  { id: "short", label: "Short", hint: "Concise output" },
  { id: "medium", label: "Medium", hint: "Balanced detail" },
  { id: "detailed", label: "Detailed", hint: "In-depth output" },
];

export const AUDIENCES: { id: AudienceId; label: string }[] = [
  { id: "government-officials", label: "Government Officials" },
  { id: "senior-leadership", label: "Senior Leadership" },
  { id: "department-employees", label: "Department Employees" },
  { id: "public", label: "Public" },
  { id: "general", label: "General Audience" },
];

export const ALL_LENGTH_IDS: LengthId[] = LENGTHS.map((l) => l.id);
export const ALL_AUDIENCE_IDS: AudienceId[] = AUDIENCES.map((a) => a.id);
export const ALL_TRANSFORMATION_IDS: TransformationId[] = TRANSFORMATIONS.map((t) => t.id);

/* ------------------------------ Sectors & roles ----------------------------- */

export const SECTORS: { id: string; label: string; description: string; icon: string; available: boolean }[] = [
  { id: "government", label: "Government", description: "Departments, ministries & public administration", icon: "landmark", available: true },
  { id: "private", label: "Private Sector", description: "Corporate teams & commercial organisations", icon: "building", available: false },
  { id: "enterprise", label: "Enterprise", description: "Large cross-functional organisations", icon: "network", available: false },
  { id: "education", label: "Education", description: "Institutions, universities & research", icon: "graduation", available: false },
  { id: "personal", label: "Personal", description: "Individual use & independent work", icon: "user", available: false },
];

export const ROLES: { id: string; label: string; description: string }[] = [
  { id: "Administrator", label: "Administrator", description: "Manage systems, access and policies" },
  { id: "Government Officer", label: "Government Officer", description: "Handle cases, documents and correspondence" },
  { id: "Manager", label: "Manager", description: "Lead teams and review outputs" },
  { id: "Analyst", label: "Analyst", description: "Analyse data and produce insights" },
  { id: "Communication Officer", label: "Communication Officer", description: "Draft public and internal communications" },
  { id: "Project Officer", label: "Project Officer", description: "Run programmes and track delivery" },
  { id: "Employee", label: "Employee", description: "Day-to-day departmental work" },
  { id: "Other", label: "Other", description: "Something else entirely" },
];

export const DEPARTMENT_SUGGESTIONS = [
  "Ministry of Home Affairs",
  "Department of Information Technology",
  "State Secretariat",
  "Municipal Corporation",
  "Public Works Department",
  "Revenue Department",
  "Education Department",
  "Health Department",
  "Finance Department",
  "Rural Development Department",
];

/* --------------------------------- Preferences ------------------------------ */

export const DEFAULT_PREFERENCES: Preferences = {
  tone: "professional",
  length: "medium",
  defaultTransformation: "executive-brief",
  autoSave: true,
  compact: false,
  reduceMotion: false,
  notifTransformation: true,
  notifUpload: true,
  notifWorkspace: true,
  notifStorage: true,
  notifUpdates: false,
};

export const HELP_FAQ = [
  {
    q: "How does ERA transform my documents?",
    a: "Upload a document on the Dashboard, choose what you want to create — from an Executive Brief to a LinkedIn Post — then configure tone, length and audience in the workspace. ERA generates a structured result you can edit, copy, download or export.",
  },
  {
    q: "Which file formats are supported?",
    a: "ERA supports PDF, DOCX, PPTX, XLSX and TXT files up to 25 MB per file. You can add multiple files and use them together in one transformation.",
  },
  {
    q: "Which sectors and languages are available?",
    a: "ERA currently serves Government workspaces and generates content in English. Private Sector, Enterprise, Education and Personal workspaces are marked Coming Soon, as is translation into other languages.",
  },
  {
    q: "How do LinkedIn and Twitter/X previews work?",
    a: "When you choose a social post work type, ERA shows the generated content inside a realistic platform preview so you can see how the post will appear. Editing the content updates the preview in real time.",
  },
  {
    q: "Is my data private?",
    a: "Your workspace is private to your department. Documents are processed in your secure workspace and results are only visible to people you share them with. Your workspace is private.",
  },
  {
    q: "How do I manage files in my workspace?",
    a: "Open the Files page to search, filter, sort and organise your documents. You can rename, move, download, share or delete any file using its More menu.",
  },
  {
    q: "How do I contact support?",
    a: "Use the Contact Support form on the Help page. Our team responds to government department queries within one business day.",
  },
];

export const helpTopics = [
  { id: "get-started", title: "Getting Started", description: "Set up your government workspace and upload your first document." },
  { id: "upload", title: "Uploading Documents", description: "Formats, limits and the upload workflow on the Dashboard." },
  { id: "transform", title: "Choosing a Transformation", description: "From Executive Briefs to social posts — how to choose work." },
  { id: "generate", title: "Generating Content", description: "Configure tone, length and audience, then generate." },
  { id: "files", title: "Managing Files", description: "Upload, organise, search and share documents." },
  { id: "linkedin-preview", title: "Using LinkedIn Previews", description: "How LinkedIn post previews work." },
  { id: "linkedin-story", title: "Using LinkedIn Stories", description: "The portrait story format explained." },
  { id: "twitter-preview", title: "Using Twitter/X Previews", description: "Short-form post previews and character limits." },
  { id: "account", title: "Account & Security", description: "Profile, password, sessions and sign-in activity." },
];
