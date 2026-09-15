import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Eye,
  FolderOpen,
  Pencil,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, Button, Modal, badgeTone, formatBytes } from "./ui";
import { useAuth } from "../context/AuthContext";
import { getFileActivity, getFileOutputs, updateFileLastOpened } from "../services/firestoreService";
import type { ActivityRecord, AppFile, TransformationOutput } from "../types";
import { PlatformPreview } from "./previews";

interface FileDetailsModalProps {
  file: AppFile | null;
  open: boolean;
  onClose: () => void;
  onOpenWorkspace: (file: AppFile) => void;
  onShare: (file: AppFile) => void;
  onRename: (file: AppFile) => void;
  onDelete: (file: AppFile) => void;
}

import { formatExactDateTime } from "../utils/date";

export default function FileDetailsModal({
  file,
  open,
  onClose,
  onOpenWorkspace,
  onShare,
  onRename,
  onDelete,
}: FileDetailsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"outputs" | "activity" | "sharing">("outputs");
  const [outputs, setOutputs] = useState<TransformationOutput[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [viewOutput, setViewOutput] = useState<TransformationOutput | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (file && open) {
      setLoading(true);
      const ownerId = file.ownerId || user?.user_id || "anonymous";
      const fileId = file.fileId || file.id;

      // Update lastOpenedAt in Firestore
      if (user) {
        updateFileLastOpened(ownerId, fileId, user);
      }

      Promise.all([getFileOutputs(ownerId, fileId), getFileActivity(ownerId, fileId)])
        .then(([outs, acts]) => {
          setOutputs(outs);
          setActivity(acts);
        })
        .finally(() => setLoading(false));
    }
  }, [file, open, user]);

  if (!file) return null;

  const createdDate = formatExactDateTime(file.createdAt);
  const modifiedDate = formatExactDateTime(file.updatedAt || file.createdAt);
  const openedDate = formatExactDateTime(file.lastOpenedAt || file.updatedAt || file.createdAt);

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="space-y-5 text-left">
        {/* Header (Requirement 10) */}
        <div className="border-b border-line pb-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Document Workspace</span>
            <Badge className={badgeTone.info}>{file.kind.toUpperCase()} · {file.status.toUpperCase()}</Badge>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
            {file.title || file.name}
          </h2>
          <p className="mt-0.5 text-xs text-mute font-mono">{file.filename}</p>
        </div>

        {/* Metadata Grid (Requirement 10) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-line bg-s2/50 p-3.5 text-xs">
          <div>
            <span className="text-[10.5px] text-mute block font-medium">Created By:</span>
            <span className="font-bold text-ink truncate block">{file.ownerName || file.owner}</span>
            <span className="text-[10px] text-soft truncate block">{file.ownerEmail}</span>
          </div>

          <div>
            <span className="text-[10.5px] text-mute block font-medium">Created:</span>
            <span className="font-bold text-ink block">{createdDate}</span>
          </div>

          <div>
            <span className="text-[10.5px] text-mute block font-medium">Last Modified:</span>
            <span className="font-bold text-ink block">{modifiedDate}</span>
          </div>

          <div>
            <span className="text-[10.5px] text-mute block font-medium">Last Opened:</span>
            <span className="font-bold text-ink block">{openedDate}</span>
          </div>

          <div>
            <span className="text-[10.5px] text-mute block font-medium">File Size:</span>
            <span className="font-bold text-ink block">{formatBytes(file.size)}</span>
          </div>

          <div>
            <span className="text-[10.5px] text-mute block font-medium">Sharing:</span>
            <span className="font-bold text-ink block">
              {file.sharedWith && file.sharedWith.length > 0
                ? `Shared (${file.sharedWith.length})`
                : "Private"}
            </span>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => { onClose(); onOpenWorkspace(file); }} icon={<FolderOpen className="h-4 w-4" />}>
            Open Workspace
          </Button>
          <Button variant="secondary" onClick={() => onShare(file)} icon={<Share2 className="h-4 w-4" />}>
            Share
          </Button>
          <Button variant="secondary" onClick={() => onRename(file)} icon={<Pencil className="h-4 w-4" />}>
            Rename
          </Button>
          <Button variant="ghost" onClick={() => onDelete(file)} icon={<Trash2 className="h-4 w-4 text-danger" />}>
            Delete
          </Button>
        </div>

        {/* Sub-tabs: Transformations History | Activity History | Sharing */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            {[
              { id: "outputs", label: `Transformations (${outputs.length})`, icon: Sparkles },
              { id: "activity", label: `Activity (${activity.length})`, icon: Activity },
              { id: "sharing", label: `Sharing (${file.sharedWith?.length || 0})`, icon: Share2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setViewOutput(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === tab.id ? "bg-brand text-white shadow-sm" : "text-mute hover:bg-s2 hover:text-ink"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-4 text-center text-xs text-mute font-medium">Loading details...</div>
          ) : viewOutput ? (
            <div className="space-y-3 rounded-xl border border-line bg-s2/30 p-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-bold text-ink">Saved Output: {viewOutput.title}</span>
                <Button variant="ghost" onClick={() => setViewOutput(null)}>
                  Close Saved Preview
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                <PlatformPreview work={viewOutput.transformation} content={viewOutput.content} />
              </div>
            </div>
          ) : activeTab === "outputs" ? (
            <div className="space-y-2">
              {outputs.length > 0 ? (
                <div className="divide-y divide-line rounded-xl border border-line bg-white">
                  {outputs.map((out) => (
                    <div key={out.outputId} className="flex items-center justify-between p-3 transition hover:bg-s2/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-ink">{out.title || out.transformation}</p>
                          <p className="text-[11px] text-mute">
                            Generated by {out.createdByName} · {new Date(out.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="secondary" onClick={() => setViewOutput(out)} icon={<Eye className="h-3.5 w-3.5" />}>
                        View Output
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-6 text-center text-xs text-soft border border-dashed border-line rounded-xl">
                  No transformations generated for this document yet. Click "Open Workspace" to run summaries, presentations or meeting notes.
                </p>
              )}
            </div>
          ) : activeTab === "activity" ? (
            <div className="space-y-2">
              {activity.length > 0 ? (
                <div className="divide-y divide-line rounded-xl border border-line bg-white max-h-60 overflow-y-auto">
                  {activity.map((act) => (
                    <div key={act.activityId} className="p-3 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-ink capitalize">
                          {act.actorName} <span className="font-normal text-mute">{act.action.replace("_", " ")}</span>
                        </p>
                        {act.metadata?.transformation && (
                          <p className="text-[11px] text-brand font-medium">Transformation: {act.metadata.transformation}</p>
                        )}
                        {act.metadata?.newTitle && (
                          <p className="text-[11px] text-mute">Renamed to: {act.metadata.newTitle}</p>
                        )}
                      </div>
                      <span className="text-[10.5px] text-soft">{new Date(act.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-6 text-center text-xs text-soft border border-dashed border-line rounded-xl">
                  No activity history logged yet.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl border border-line bg-white p-3 space-y-2 text-xs">
                <p className="font-bold text-ink">Owner: {file.ownerName} ({file.ownerEmail})</p>
                {file.sharedWith && file.sharedWith.length > 0 ? (
                  file.sharedWith.map((sw, i) => (
                    <div key={i} className="flex justify-between border-t border-line/60 pt-2 text-mute">
                      <span>{sw.sharedWithEmail}</span>
                      <span className="font-bold capitalize">{sw.permission}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-soft border-t border-line/60 pt-2">Private document — not shared with other users.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
