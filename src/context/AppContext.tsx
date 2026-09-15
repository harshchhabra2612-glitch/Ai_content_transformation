import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AppFile,
  FileKind,
  GeneratedResult,
  NotificationItem,
  Preferences,
  RecentRow,
  TransformationId,
  WorkspaceConfig,
} from "../types";
import {
  ALL_AUDIENCE_IDS,
  ALL_LENGTH_IDS,
  ALL_TONES,
  ALL_TRANSFORMATION_IDS,
  DEFAULT_PREFERENCES,
} from "../data/mock";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import { uploadDocument } from "../services/api";
import type { UploadProcessingStatus, ProcessingFileMeta } from "../components/DocumentProcessingModal";
import {
  deleteFileRecord,
  saveTransformationOutput,
  subscribeUserFiles,
  updateFileLastOpened,
  updateFileTitle,
} from "../services/firestoreService";

interface Stats {
  documents: number;
  transformations: number;
  hours: number;
  storageGB: number;
}

interface AppCtx {
  // workspace session (dashboard → choose work → configure → preview)
  sessionFiles: AppFile[];
  activeFile: AppFile | null;
  setActiveFile: (file: AppFile | null) => void;
  selectedTransformation: TransformationId | null;
  selectedTransformations: TransformationId[];
  wsConfig: WorkspaceConfig;
  generated: GeneratedResult | null;
  generatedResults: GeneratedResult[];
  addFiles: (files: { name: string; kind: FileKind; size: number; rawFile?: File }[]) => Promise<AppFile[]>;
  removeSessionFile: (id: string) => void;
  clearSession: () => void;
  setSelectedTransformation: (t: TransformationId | null) => void;
  setSelectedTransformations: (ts: TransformationId[]) => void;
  toggleTransformation: (t: TransformationId) => void;
  updateWsConfig: (patch: Partial<WorkspaceConfig>) => void;
  setGenerated: (g: GeneratedResult | null) => void;
  setGeneratedResults: (g: GeneratedResult[]) => void;
  persistGeneratedOutput: (output: { transformation: TransformationId; title: string; content: string; structuredData?: any }) => Promise<void>;

  // upload processing state
  uploadProcessingStatus: UploadProcessingStatus;
  processingFile: ProcessingFileMeta | null;
  processingError: string | null;
  resetProcessingState: () => void;

  // library
  library: AppFile[];
  addToLibrary: (files: { name: string; kind: FileKind; size: number; rawFile?: File }[]) => void;
  addFolder: (name: string) => void;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  toggleStar: (id: string) => void;

  // workspace seeding
  seedFile: AppFile | null;
  openInWorkspace: (file: AppFile) => void;

  // recents + stats + recent transformations
  recents: RecentRow[];
  stats: Stats;
  recentTransformations: { id: string; source: string; target: string; status: string; time: string }[];
  recordTransformation: (name: string, kind: FileKind, transformationLabel: string) => void;
  markOpened: (row: Pick<RecentRow, "name" | "kind">) => void;

  // notifications
  notifications: NotificationItem[];
  markAllRead: () => void;
  clearNotifications: () => void;
  toggleNotification: (id: string) => void;

  // preferences
  prefs: Preferences;
  updatePrefs: (patch: Partial<Preferences>) => void;

  // data management
  clearAllData: () => void;
}


const Ctx = createContext<AppCtx | null>(null);

// One-time cleanup for legacy demo/seeded records stored in localStorage from previous development runs
try {
  if (typeof localStorage !== "undefined" && localStorage.getItem("era-cleaned-v3") !== "true") {
    localStorage.removeItem("era-recents");
    localStorage.removeItem("era-recent-transformations");
    localStorage.removeItem("era-generated");
    localStorage.removeItem("era-generated-results");
    localStorage.setItem("era-stats", JSON.stringify({ documents: 0, transformations: 0, hours: 0, storageGB: 0 }));
    localStorage.setItem("era-cleaned-v3", "true");
  }
} catch {
  /* ignore */
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const DEMO_TRANSFORMATION_LABELS = new Set([
  "Meeting Notes",
  "Executive Brief",
  "Summarize",
  "Twitter/X Post",
  "Photo Generation",
  "Video Generation",
  "Government Report",
  "Presentation",
  "Action Items",
  "Email",
  "FAQ",
  "Rewrite",
  "Extract Key Points",
  "LinkedIn Post",
  "LinkedIn Story",
]);



function filterDemoRecentTransformations(items: { id: string; source: string; target: string; status: string; time: string }[]) {
  if (!Array.isArray(items)) return [];
  return items.filter((t) => !t.target || !DEMO_TRANSFORMATION_LABELS.has(t.target));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const DEFAULTS_CFG: WorkspaceConfig = { tone: "professional", length: "medium", audience: "government-officials" };

function sanitizeCfg(cfg: Partial<WorkspaceConfig> | null | undefined): WorkspaceConfig {
  const base = { ...DEFAULTS_CFG, ...(cfg ?? {}) };
  return {
    tone: ALL_TONES.some((t) => t.id === base.tone) ? base.tone : DEFAULTS_CFG.tone,
    length: (ALL_LENGTH_IDS as string[]).includes(base.length) ? base.length : DEFAULTS_CFG.length,
    audience: (ALL_AUDIENCE_IDS as string[]).includes(base.audience) ? base.audience : DEFAULTS_CFG.audience,
  };
}

function sanitizePrefs(p: Partial<Preferences>): Preferences {
  const base = { ...DEFAULT_PREFERENCES, ...p };
  return {
    ...base,
    tone: ALL_TONES.some((t) => t.id === base.tone) ? base.tone : DEFAULT_PREFERENCES.tone,
    length: (ALL_LENGTH_IDS as string[]).includes(base.length) ? base.length : DEFAULT_PREFERENCES.length,
    defaultTransformation: (ALL_TRANSFORMATION_IDS as string[]).includes(base.defaultTransformation)
      ? base.defaultTransformation
      : DEFAULT_PREFERENCES.defaultTransformation,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { user } = useAuth();
  const [sessionFiles, setSessionFiles] = useState<AppFile[]>(() =>
    readJSON<AppFile[]>("era-session-files", []).map((f) => ({ ...f, status: "ready" as const, progress: 100 }))
  );
  const [activeFile, setActiveFileState] = useState<AppFile | null>(null);

  const [selectedTransformations, setSelectedTransformationsState] = useState<TransformationId[]>(() => {
    const raw = readJSON<string[] | string | null>("era-session-transforms", null);
    if (Array.isArray(raw)) {
      return raw.filter((x) => (ALL_TRANSFORMATION_IDS as string[]).includes(x)) as TransformationId[];
    }
    const single = readJSON<string | null>("era-session-transform", null);
    return single && (ALL_TRANSFORMATION_IDS as string[]).includes(single) ? [single as TransformationId] : [];
  });
  const selectedTransformation = selectedTransformations[0] ?? null;
  const setSelectedTransformation = useCallback((t: TransformationId | null) => {
    setSelectedTransformationsState(t ? [t] : []);
  }, []);
  const setSelectedTransformations = useCallback((ts: TransformationId[]) => {
    setSelectedTransformationsState(ts);
  }, []);
  const toggleTransformation = useCallback((t: TransformationId) => {
    setSelectedTransformationsState((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }, []);

  const [wsConfig, setWsConfig] = useState<WorkspaceConfig>(() => sanitizeCfg(readJSON<Partial<WorkspaceConfig> | null>("era-ws-config", null)));
  const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>(() => readJSON<GeneratedResult[]>("era-generated-results", []));
  const [generated, setGeneratedState] = useState<GeneratedResult | null>(() => readJSON<GeneratedResult | null>("era-generated", null));
  const setGenerated = useCallback((g: GeneratedResult | null) => {
    setGeneratedState(g);
    if (g) {
      setGeneratedResults((prev) => {
        const idx = prev.findIndex((p) => p.transformation === g.transformation);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = g;
          return next;
        }
        return [...prev, g];
      });
    } else {
      setGeneratedResults([]);
    }
  }, []);

  const [library, setLibrary] = useState<AppFile[]>([]);
  const [recents, setRecents] = useState<RecentRow[]>([]);
  const [seedFile, setSeedFile] = useState<AppFile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    readJSON<NotificationItem[]>("era-notifs", [])
  );
  const [prefs, setPrefs] = useState<Preferences>(() => sanitizePrefs(readJSON<Partial<Preferences>>("era-prefs", {})));
  const [stats, setStats] = useState<Stats>(() =>
    readJSON<Stats>("era-stats", { documents: 0, transformations: 0, hours: 0, storageGB: 0 })
  );
  const [recentTransformations, setRecentTransformations] = useState<{ id: string; source: string; target: string; status: string; time: string }[]>(
    () => filterDemoRecentTransformations(readJSON("era-recent-transformations", []))
  );

  const [uploadProcessingStatus, setUploadProcessingStatus] = useState<UploadProcessingStatus>("IDLE");
  const [processingFile, setProcessingFile] = useState<ProcessingFileMeta | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const resetProcessingState = useCallback(() => {
    setUploadProcessingStatus("IDLE");
    setProcessingFile(null);
    setProcessingError(null);
  }, []);

  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const activeUploads = useRef<Set<string>>(new Set());
  const sessionRef = useRef<AppFile[]>([]);
  useEffect(() => {
    sessionRef.current = sessionFiles;
  }, [sessionFiles]);

  // Subscribe to authenticated user's Firestore files & shared files
  useEffect(() => {
    if (user && user.user_id) {
      const unsub = subscribeUserFiles(user, (files) => {
        setLibrary(files);
      });
      return () => unsub();
    } else {
      setLibrary([]);
    }
  }, [user]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const persist = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => persist("era-session-files", sessionFiles), [sessionFiles]);
  useEffect(() => persist("era-session-transforms", selectedTransformations), [selectedTransformations]);
  useEffect(() => persist("era-session-transform", selectedTransformation), [selectedTransformation]);
  useEffect(() => persist("era-ws-config", wsConfig), [wsConfig]);
  useEffect(() => persist("era-generated", generated), [generated]);
  useEffect(() => persist("era-generated-results", generatedResults), [generatedResults]);
  useEffect(() => persist("era-notifs", notifications), [notifications]);
  useEffect(() => persist("era-prefs", prefs), [prefs]);
  useEffect(() => persist("era-stats", stats), [stats]);
  useEffect(() => persist("era-recent-transformations", recentTransformations), [recentTransformations]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", prefs.reduceMotion);
  }, [prefs]);

  /* ------------------------------ Upload engine ------------------------------ */

  const addFiles = useCallback(
    async (files: { name: string; kind: FileKind; size: number; rawFile?: File }[]): Promise<AppFile[]> => {
      const createdList: AppFile[] = [];

      for (const item of files) {
        console.log(`[ERA UPLOAD] file selected ${item.name}`);
        const fileObj = item.rawFile || new File(["ERA document content"], item.name, { type: "application/pdf" });
        const fid = "file_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

        setProcessingFile({ name: item.name, kind: item.kind, size: item.size });
        setUploadProcessingStatus("UPLOADING");
        setProcessingError(null);

        try {
          // 1. Send ACTUAL File to FastAPI backend /api/upload
          console.log(`[ERA UPLOAD] backend upload started`);
          setUploadProcessingStatus("PROCESSING");
          toast.info("Uploading document...", item.name);

          let backendRes: any = null;
          try {
            backendRes = await uploadDocument(fileObj);
            const docId = backendRes?.document_id || fid;
            console.log(`[ERA UPLOAD] backend upload complete`);
            console.log(`[ERA UPLOAD] document_id received ${docId}`);
          } catch (bErr: any) {
            console.error("[ERA UPLOAD ERROR] Backend /api/upload error:", bErr);
            setUploadProcessingStatus("ERROR");
            setProcessingError(bErr?.message || `Could not process ${item.name}.`);
            toast.error("Unable to process this document. Please try again.", bErr?.message || `Could not process ${item.name}.`);
            throw bErr;
          }

          const docId = backendRes?.document_id || fid;
          const title = item.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

          // Preserve selected transformation or default to executive-brief
          let currentTransforms = selectedTransformations;
          if (currentTransforms.length === 0 && !selectedTransformation) {
            currentTransforms = ["executive-brief"];
            setSelectedTransformations(["executive-brief"]);
          }
          const activeTrans = currentTransforms.length > 0 ? currentTransforms[0] : (selectedTransformation || "executive-brief");
          console.log(`[ERA UPLOAD] transformation preserved ${activeTrans}`);

          const createdRecord: AppFile = {
            id: fid,
            fileId: fid,
            document_id: docId,
            filename: item.name,
            name: title,
            title: title,
            kind: item.kind,
            extension: item.name.split(".").pop()?.toLowerCase() || "pdf",
            fileType: fileObj.type || "application/pdf",
            size: item.size,
            ownerId: user?.user_id || "anonymous",
            ownerName: user?.name || "User",
            ownerEmail: user?.email || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
            status: "ready",
            pageCount: backendRes?.page_count || 1,
            transformations: [],
            sharedWith: [],
            source: "upload",
            rawFile: fileObj,
          };

          // 2. Save document to workspace state & sessionStorage
          console.log(`[ERA UPLOAD] workspace state saved`);
          setActiveFileState(createdRecord);

          // Clear previous generated outputs for previous document
          setGeneratedState(null);
          setGeneratedResults([]);
          persist("era-generated", null);
          persist("era-generated-results", []);
          setSessionFiles((prev) => {
            const updated = [...prev.filter((f) => f.fileId !== fid && f.id !== fid), createdRecord];
            persist("era-session-files", updated);
            try {
              sessionStorage.setItem("era_workspace_current_document", JSON.stringify(createdRecord));
              sessionStorage.setItem("era-session-files", JSON.stringify(updated));
            } catch {
              /* ignore sessionStorage quota */
            }
            return updated;
          });

          setLibrary((prev) => {
            if (!prev.some((f) => f.id === fid || f.fileId === fid)) {
              return [createdRecord, ...prev];
            }
            return prev;
          });

          setProcessingFile({ name: item.name, kind: item.kind, size: item.size, document_id: docId });
          setUploadProcessingStatus("READY");
          createdList.push(createdRecord);
          toast.success("Document ready", `${createdRecord.title} processed.`);
        } catch (err: any) {
          console.error("[ERA UPLOAD ITEM ERROR]:", err);
        }
      }
      return createdList;
    },
    [user, selectedTransformations, selectedTransformation, setSelectedTransformations, persist, toast]
  );

  const removeSessionFile = useCallback((id: string) => {
    activeUploads.current.delete(id);
    sessionRef.current = sessionRef.current.filter((f) => f.id !== id);
    setSessionFiles(sessionRef.current);
  }, []);

  const clearSession = useCallback(() => {
    activeUploads.current.clear();
    sessionRef.current = [];
    setSessionFiles([]);
    setSelectedTransformationsState([]);
    setGeneratedState(null);
    setGeneratedResults([]);
    setSeedFile(null);
    setActiveFileState(null);
    persist("era-ws-config", { tone: "professional", length: "medium", audience: "government-officials" });
    setWsConfig({ tone: "professional", length: "medium", audience: "government-officials" });
  }, []);

  const clearAllData = useCallback(() => {
    activeUploads.current.clear();
    sessionRef.current = [];
    setSessionFiles([]);
    setSelectedTransformationsState([]);
    setGeneratedState(null);
    setGeneratedResults([]);
    setRecents([]);
    setNotifications([]);
    setStats({ documents: 0, transformations: 0, hours: 0, storageGB: 0 });
    setRecentTransformations([]);
    setSeedFile(null);
    setActiveFileState(null);
    toast.success("Workspace reset", "Session cache reset.");
  }, [toast]);

  const updateWsConfig = useCallback((patch: Partial<WorkspaceConfig>) => {
    setWsConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  /* --------------------------------- Library -------------------------------- */

  const addToLibrary = useCallback(
    async (files: { name: string; kind: FileKind; size: number; rawFile?: File }[]) => {
      await addFiles(files);
    },
    [addFiles]
  );

  const addFolder = useCallback(
    (name: string) => {
      const folderRecord: AppFile = {
        id: uid(),
        fileId: uid(),
        filename: name,
        name,
        title: name,
        kind: "folder",
        extension: "folder",
        fileType: "folder",
        size: 0,
        ownerId: user?.user_id || "anonymous",
        ownerName: user?.name || "You",
        ownerEmail: user?.email || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        status: "ready",
        transformations: [],
        sharedWith: [],
        source: "created",
        folder: true,
      };
      setLibrary((prev) => [folderRecord, ...prev]);
      toast.success("Folder created", name);
    },
    [user, toast]
  );

  const renameFile = useCallback(
    async (id: string, name: string) => {
      const target = library.find((f) => f.id === id || f.fileId === id);
      setLibrary((prev) => prev.map((f) => (f.id === id || f.fileId === id ? { ...f, name, title: name } : f)));
      toast.success("File title updated", name);
      if (user && target) {
        try {
          await updateFileTitle(target.ownerId || user.user_id || "anonymous", target.fileId || target.id, name, user);
        } catch (err) {
          console.warn("Could not sync rename to Firestore:", err);
        }
      }
    },
    [library, user, toast]
  );

  const deleteFile = useCallback(
    async (id: string) => {
      const target = library.find((f) => f.id === id || f.fileId === id);
      setLibrary((prev) => prev.filter((x) => x.id !== id && x.fileId !== id));
      if (target) toast.success("File removed", `${target.title || target.name} deleted.`);
      if (user && target) {
        try {
          await deleteFileRecord(target.ownerId || user.user_id || "anonymous", target.fileId || target.id, target.storagePath, user);
        } catch (err) {
          console.warn("Could not sync delete to Firestore:", err);
        }
      }
    },
    [library, user, toast]
  );

  const toggleStar = useCallback((id: string) => {
    setLibrary((prev) => prev.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f)));
  }, []);

  const openInWorkspace = useCallback(
    (file: AppFile) => {
      const fid = file.fileId || file.id;
      console.log("[ERA WORKSPACE] Document state saved: fileId=" + fid);
      setSeedFile(file);
      setActiveFileState(file);

      // CLEAR PREVIOUS DOCUMENT TRANSFORMATION CACHE TO PREVENT CONTAMINATION
      setGeneratedState(null);
      setGeneratedResults([]);
      persist("era-generated", null);
      persist("era-generated-results", []);

      const readyDoc: AppFile = { ...file, status: "ready" };
      setSessionFiles([readyDoc]);
      persist("era-session-files", [readyDoc]);
      try {
        sessionStorage.setItem("era_workspace_current_document", JSON.stringify(readyDoc));
        sessionStorage.setItem("era-session-files", JSON.stringify([readyDoc]));
      } catch {
        /* ignore */
      }
      if (user) {
        updateFileLastOpened(file.ownerId || user.user_id || "anonymous", fid, user).catch(() => {});
      }
    },
    [user]
  );

  const persistGeneratedOutput = useCallback(
    async (out: { transformation: TransformationId; title: string; content: string; structuredData?: any }) => {
      const targetFile = activeFile || sessionFiles[0] || library[0];
      if (targetFile && user) {
        try {
          await saveTransformationOutput(
            targetFile.ownerId || user.user_id || "anonymous",
            targetFile.fileId || targetFile.id,
            out,
            user
          );
        } catch (err) {
          console.warn("Could not persist output to Firestore:", err);
        }
      }
    },
    [activeFile, sessionFiles, library, user]
  );

  /* ------------------------------ Recents + stats ---------------------------- */

  const recordTransformation = useCallback(
    (_name: string, _kind: FileKind, _transformationLabel: string) => {
    },
    []
  );

  const markOpened = useCallback((row: Pick<RecentRow, "name" | "kind">) => {
    setRecents((prev) => {
      const exists = prev.some((r) => r.name === row.name);
      if (exists) return prev;
      return [
        {
          id: uid(),
          name: row.name,
          kind: row.kind,
          activity: "opened" as const,
          modified: new Date().toISOString(),
          owner: "You",
        },
        ...prev,
      ].slice(0, 30);
    });
  }, []);

  /* ------------------------------ Notifications ------------------------------ */

  const markAllRead = useCallback(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const toggleNotification = useCallback(
    (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))),
    []
  );

  /* -------------------------------- Preferences ------------------------------ */

  const updatePrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      sessionFiles,
      activeFile,
      setActiveFile: setActiveFileState,
      selectedTransformation,
      selectedTransformations,
      wsConfig,
      generated,
      generatedResults,
      addFiles,
      removeSessionFile,
      clearSession,
      setSelectedTransformation,
      setSelectedTransformations,
      toggleTransformation,
      updateWsConfig,
      setGenerated,
      setGeneratedResults,
      persistGeneratedOutput,
      library,
      addToLibrary,
      addFolder,
      renameFile,
      deleteFile,
      toggleStar,
      seedFile,
      openInWorkspace,
      recents,
      stats,
      recentTransformations,
      recordTransformation,
      markOpened,
      notifications,
      markAllRead,
      clearNotifications,
      toggleNotification,
      prefs,
      updatePrefs,
      clearAllData,
      uploadProcessingStatus,
      processingFile,
      processingError,
      resetProcessingState,
    }),
    [
      sessionFiles,
      activeFile,
      selectedTransformation,
      selectedTransformations,
      wsConfig,
      generated,
      generatedResults,
      addFiles,
      removeSessionFile,
      clearSession,
      setSelectedTransformation,
      setSelectedTransformations,
      toggleTransformation,
      updateWsConfig,
      setGenerated,
      setGeneratedResults,
      persistGeneratedOutput,
      library,
      addToLibrary,
      addFolder,
      renameFile,
      deleteFile,
      toggleStar,
      seedFile,
      openInWorkspace,
      recents,
      stats,
      recentTransformations,
      recordTransformation,
      markOpened,
      notifications,
      markAllRead,
      clearNotifications,
      toggleNotification,
      prefs,
      updatePrefs,
      clearAllData,
      uploadProcessingStatus,
      processingFile,
      processingError,
      resetProcessingState,
    ]
  );


  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
