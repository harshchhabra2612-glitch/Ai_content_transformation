export type FileKind =
  | "pdf" | "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx"
  | "odt" | "ods" | "odp" | "txt" | "csv" | "tsv" | "md" | "rtf"
  | "json" | "xml" | "html" | "htm"
  | "png" | "jpg" | "jpeg" | "webp" | "tiff" | "tif" | "bmp"
  | "mp3" | "wav" | "m4a" | "aac" | "ogg" | "flac"
  | "mp4" | "mov" | "webm" | "mkv" | "avi"
  | "zip" | "7z" | "tar" | "tgz" | "gz";
export type FileStatus = "uploading" | "processing" | "ready" | "failed" | "archived";

export interface SharedUser {
  shareId: string;
  fileId: string;
  ownerId: string;
  sharedWithUserId?: string;
  sharedWithEmail: string;
  sharedWithName?: string;
  permission: "viewer" | "editor";
  sharedBy: string;
  sharedByName?: string;
  sharedAt: string;
}

export interface AppFile {
  id: string; // fileId alias
  fileId: string;
  document_id?: string;
  filename: string;
  name: string; // title or filename
  title: string;
  kind: FileKind | "folder";
  extension: string;
  fileType: string;
  size: number; // bytes
  storagePath?: string;
  downloadUrl?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  lastOpenedAt: string; // ISO date
  status: FileStatus;
  progress?: number;
  pageCount?: number;
  transformations: TransformationId[];
  sharedWith: SharedUser[];
  sharedWithEmails?: string[];
  editorEmails?: string[];
  source: "upload" | "created" | "shared";
  starred?: boolean;
  folder?: boolean;
  rawFile?: File;
  // legacy backward compat
  modified?: string;
  owner?: string;
}

export interface TransformationOutput {
  outputId: string;
  fileId: string;
  transformation: TransformationId;
  title: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  status: "completed" | "failed";
  content: string;
  structuredData?: any;
  sources?: any[];
}

export type ActivityAction =
  | "uploaded"
  | "opened"
  | "renamed"
  | "transformed"
  | "edited"
  | "shared"
  | "permission_changed"
  | "downloaded"
  | "archived";

export interface ActivityRecord {
  activityId: string;
  fileId: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: ActivityAction;
  timestamp: string; // ISO
  metadata?: Record<string, any>;
}

export type ActivityKind = "opened" | "transformed" | "uploaded";

export interface ActivityItem {
  id: string;
  fileId: string;
  name: string;
  kind: FileKind;
  activity: ActivityKind;
  modified: string;
  owner: string;
  transformation?: string;
}

export type TransformationId =
  | "summarize"
  | "executive-brief"
  | "government-report"
  | "presentation"
  | "meeting-notes"
  | "action-items"
  | "email"
  | "faq"
  | "rewrite"
  | "extract"
  | "linkedin"
  | "linkedin-story"
  | "twitter"
  | "photo-generation"
  | "video-generation";

export interface TransformationDef {
  id: TransformationId;
  label: string;
  description: string;
}

/** Tone ids across document + social work types */
export type ToneId =
  | "professional"
  | "formal"
  | "concise"
  | "executive"
  | "informative"
  | "leadership"
  | "public-announcement"
  | "announcement"
  | "public-update"
  | "professional-story"
  | "impact-story"
  | "leadership-story"
  | "public-service-story"
  | "project-story";

export type LengthId = "short" | "medium" | "detailed";

export type AudienceId =
  | "government-officials"
  | "senior-leadership"
  | "department-employees"
  | "public"
  | "general";

export type UserRole = "ADMIN" | "OFFICER" | "ANALYST" | "VIEWER";

export interface User {
  user_id?: string;
  name: string;
  email: string;
  /** Government department / organization */
  org: string;
  role: UserRole | string;
  permissions?: string[];
  mfa_enabled?: boolean;
  mfa_verified?: boolean;
  status?: string;
  workspace: string;
  onboardingDone: boolean;
  photoURL?: string;
  provider?: "email" | "google";
}

export interface AdminUser {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_verified: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  audit_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  timestamp: string;
  status: "SUCCESS" | "DENIED" | "FAILED";
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export interface DocumentRecord {
  document_id: string;
  owner_id: string;
  filename: string;
  safe_storage_filename: string;
  file_type: string;
  file_size: number;
  storage_reference: string;
  created_at: string;
  updated_at: string;
  shared_with: string[];
}

export type NotifKind = "success" | "info" | "warning";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  kind: NotifKind;
}

export interface ToastItem {
  id: string;
  kind: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
}

export interface Preferences {
  tone: ToneId;
  length: LengthId;
  defaultTransformation: TransformationId;
  autoSave: boolean;
  compact: boolean;
  reduceMotion: boolean;
  notifTransformation: boolean;
  notifUpload: boolean;
  notifWorkspace: boolean;
  notifStorage: boolean;
  notifUpdates: boolean;
}

/** Workspace configuration carried through the flow (language is fixed to English) */
export interface WorkspaceConfig {
  tone: ToneId;
  length: LengthId;
  audience: AudienceId;
}

export interface GeneratedResult {
  id: string;
  output_id?: string;
  document_id?: string;
  title: string;
  content: string;
  transformation: TransformationId;
  source?: {
    document_id?: string;
    filename?: string;
    title?: string;
  };
  createdBy?: {
    uid?: string;
    name?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt?: string;
  structuredData?: any;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms?: number;
}

export interface RecentRow {
  id: string;
  name: string;
  kind: FileKind;
  activity: ActivityKind;
  modified: string;
  owner: string;
  transformation?: string;
  lastOpenedAt?: string;
}

export interface RecentTransformation {
  id: string;
  source: string;
  target: string;
  status: "Completed" | "Processing" | "Draft";
  time: string;
}

export type SlideLayoutType =
  | "title"
  | "section"
  | "content"
  | "two_column"
  | "three_column"
  | "statistics"
  | "quote"
  | "key_points"
  | "conclusion"
  | "timeline"
  | "process"
  | "comparison";

export type PresentationThemeId =
  | "modern"
  | "corporate"
  | "academic"
  | "government"
  | "gradient"
  | "professional"
  | "minimal";

export type PresentationThemeMode = "light" | "dark";

export interface PresentationVisual {
  type: "photo" | "diagram" | "chart" | "icon" | "placeholder";
  description: string;
}

export interface PresentationColumn {
  title?: string;
  text?: string;
  bullets?: string[];
}

export interface PresentationSlide {
  slide_number: number;
  layout?: SlideLayoutType;
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  columns?: PresentationColumn[];
  statNumber?: string;
  statLabel?: string;
  quoteAuthor?: string;
  visual?: PresentationVisual;
}

export interface PresentationOutput {
  transformation: "presentation";
  title?: string;
  subtitle?: string;
  theme?: PresentationThemeId;
  mode?: PresentationThemeMode;
  slides: PresentationSlide[];
  sources?: { filename: string; page: number }[];
  content?: string;
}

export interface MeetingActionItem {
  task: string;
  owner?: string | null;
  due_date?: string | null;
  status: "pending" | "in_progress" | "completed";
}

export interface StructuredMeetingNotes {
  transformation: "meeting_notes";
  title: string;
  meeting_date?: string | null;
  meeting_time?: string | null;
  overview: string;
  agenda: string[];
  discussion_points: string[];
  decisions: string[];
  action_items: MeetingActionItem[];
  next_steps: string[];
  created_by: string;
  created_at: string;
  source_filename?: string;
}


