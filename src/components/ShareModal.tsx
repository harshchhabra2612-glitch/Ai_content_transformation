import { useState } from "react";
import { Link2, Mail, UserPlus, Users, Clock } from "lucide-react";
import { Button, Input, Modal, Select } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { shareFileWithUser } from "../services/firestoreService";
import type { AppFile, SharedUser } from "../types";

interface ShareModalProps {
  file: AppFile | null;
  open: boolean;
  onClose: () => void;
  onShared?: (share: SharedUser) => void;
}

export default function ShareModal({ file, open, onClose, onShared }: ShareModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(false);

  if (!file) return null;

  const handleShare = async () => {
    if (!email.trim() || !user) return;
    if (!email.includes("@")) {
      toast.error("Invalid email", "Please enter a valid user email address.");
      return;
    }

    setLoading(true);
    try {
      const shareRecord = await shareFileWithUser(
        file.ownerId || user.user_id || "anonymous",
        file.fileId || file.id,
        email.trim().toLowerCase(),
        permission,
        user
      );
      toast.success("Document shared", `Shared with ${email} as ${permission}.`);
      setEmail("");
      if (onShared) onShared(shareRecord);
      onClose();
    } catch (err: any) {
      console.error("Share error:", err);
      toast.error("Sharing failed", err?.message || "Unable to share document.");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = !user || file.ownerId === user.user_id || file.ownerEmail === user.email;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share "${file.title || file.filename}"`}
      description="Invite colleagues to view or edit this document."
      size="sm"
    >
      <div className="space-y-4 text-left">
        {/* Email & Permission Form */}
        {isOwner ? (
          <div className="space-y-3 rounded-xl border border-line bg-s2/40 p-3.5">
            <label className="block text-xs font-bold text-ink">Add Collaborator</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  icon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email.trim()) handleShare();
                  }}
                />
              </div>
              <div className="w-28 shrink-0">
                <Select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as "viewer" | "editor")}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </Select>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full mt-2"
              loading={loading}
              disabled={!email.trim()}
              onClick={handleShare}
              icon={<UserPlus className="h-4 w-4" />}
            >
              Share Document
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 font-medium">
            Shared with you by <span className="font-bold">{file.ownerName || file.ownerEmail}</span>. You have{" "}
            <span className="font-bold uppercase">{file.editorEmails?.includes(user?.email || "") ? "Editor" : "Viewer"}</span> access.
          </div>
        )}

        {/* Existing Shared Collaborators List (Requirement 19) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-mute flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-brand" /> Shared With ({file.sharedWith?.length || 0})
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-line divide-y divide-line bg-white">
            {/* Owner Row */}
            <div className="flex items-center justify-between p-2.5 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-ink truncate">{file.ownerName || "Owner"} (You)</p>
                <p className="text-[11px] text-mute truncate">{file.ownerEmail}</p>
              </div>
              <span className="rounded-full bg-brandsoft px-2.5 py-0.5 text-[10px] font-extrabold text-brand uppercase">
                Owner
              </span>
            </div>

            {/* Shared Users */}
            {file.sharedWith && file.sharedWith.length > 0 ? (
              file.sharedWith.map((sw, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{sw.sharedWithName || sw.sharedWithEmail}</p>
                    <p className="text-[11px] text-mute flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Shared {new Date(sw.sharedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-s2 px-2 py-0.5 text-[10.5px] font-bold text-mute capitalize">
                    {sw.permission}
                  </span>
                </div>
              ))
            ) : (
              <p className="p-3 text-center text-xs text-soft">Private document — not shared with anyone yet.</p>
            )}
          </div>
        </div>

        {/* Copy Shareable Link */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="secondary"
            className="w-full"
            icon={<Link2 className="h-4 w-4" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`https://era.workspace/files/${file.fileId || file.id}`);
                toast.success("Link copied", "Share link copied to clipboard.");
              } catch {
                toast.error("Could not copy", "Clipboard access was blocked.");
              }
            }}
          >
            Copy Workspace Link
          </Button>
        </div>
      </div>
    </Modal>
  );
}
