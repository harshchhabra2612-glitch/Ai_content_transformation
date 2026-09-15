import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import type {
  ActivityAction,
  ActivityRecord,
  AppFile,
  FileKind,
  FileStatus,
  SharedUser,
  TransformationId,
  TransformationOutput,
  User,
} from "../types";

function timestampToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val.toDate === "function") return val.toDate().toISOString();
  if (typeof val === "string") return val;
  if (typeof val === "number") return new Date(val).toISOString();
  return new Date().toISOString();
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length > 1) return parts.pop()!.toLowerCase();
  return "file";
}

function getFileKindFromType(filename: string, fileType: string): FileKind {
  const ext = getFileExtension(filename);
  if (ext === "pdf" || fileType.includes("pdf")) return "pdf";
  if (ext === "docx" || ext === "doc" || fileType.includes("word")) return "docx";
  if (ext === "pptx" || ext === "ppt" || fileType.includes("presentation")) return "pptx";
  if (ext === "xlsx" || ext === "xls" || fileType.includes("sheet") || fileType.includes("excel")) return "xlsx";
  return "txt";
}

/** 1. Upload binary to Firebase Storage */
export async function uploadFileToStorage(
  file: File,
  ownerId: string,
  fileId: string
): Promise<{ storagePath: string; downloadUrl: string }> {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const storagePath = `files/${ownerId}/${fileId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return { storagePath, downloadUrl };
  } catch (err) {
    console.warn("[FIREBASE STORAGE UPLOAD WARNING] Uploading binary to Storage failed, falling back to blob ref:", err);
    return {
      storagePath: `files/${ownerId}/${fileId}/${file.name}`,
      downloadUrl: "",
    };
  }
}

/** 2. Create file record in Firestore */
export async function createFileRecord(
  file: File,
  user: User,
  customFileId?: string
): Promise<AppFile> {
  const fileId = customFileId || "file_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const ext = getFileExtension(file.name);
  const kind = getFileKindFromType(file.name, file.type);
  const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

  // Upload to Storage
  const { storagePath, downloadUrl } = await uploadFileToStorage(file, user.user_id || "anonymous", fileId);

  const fileDocRef = doc(db, "users", user.user_id || "anonymous", "files", fileId);

  const fileData = {
    fileId,
    id: fileId,
    filename: file.name,
    name: title,
    title,
    kind,
    extension: ext,
    fileType: file.type || "application/octet-stream",
    size: file.size,
    storagePath,
    downloadUrl,
    ownerId: user.user_id || "anonymous",
    ownerName: user.name || user.email.split("@")[0],
    ownerEmail: user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastOpenedAt: serverTimestamp(),
    status: "ready" as FileStatus,
    pageCount: Math.max(1, Math.ceil(file.size / 50000)),
    transformations: [] as TransformationId[],
    sharedWith: [] as any[],
    sharedWithEmails: [] as string[],
    editorEmails: [] as string[],
    source: "upload" as const,
  };

  try {
    await setDoc(fileDocRef, fileData);
    await logFileActivity(user.user_id || "anonymous", fileId, "uploaded", user, { filename: file.name, size: file.size });
  } catch (firestoreErr) {
    console.warn("[FIRESTORE NOTICE] Firestore database write skipped or not configured; proceeding with Storage & local workspace state:", firestoreErr);
  }

  const now = new Date().toISOString();
  return {
    ...fileData,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    modified: now,
    owner: user.name || user.email,
    rawFile: file,
  };
}

/** 3. Update file title / metadata */
export async function updateFileTitle(
  ownerId: string,
  fileId: string,
  newTitle: string,
  actor: User
): Promise<void> {
  const fileRef = doc(db, "users", ownerId, "files", fileId);
  await updateDoc(fileRef, {
    title: newTitle,
    name: newTitle,
    updatedAt: serverTimestamp(),
  });
  await logFileActivity(ownerId, fileId, "renamed", actor, { newTitle });
}

/** 4. Update file lastOpenedAt */
export async function updateFileLastOpened(ownerId: string, fileId: string, actor: User): Promise<void> {
  try {
    const fileRef = doc(db, "users", ownerId, "files", fileId);
    await updateDoc(fileRef, {
      lastOpenedAt: serverTimestamp(),
    });
    await logFileActivity(ownerId, fileId, "opened", actor);
  } catch (err) {
    console.warn("[FIRESTORE UPDATE WARNING] Could not update lastOpenedAt:", err);
  }
}

/** 5. Save generated transformation output to Firestore */
export async function saveTransformationOutput(
  ownerId: string,
  fileId: string,
  outputData: {
    transformation: TransformationId;
    title: string;
    content: string;
    structuredData?: any;
    sources?: any[];
  },
  user: User
): Promise<TransformationOutput> {
  const outputId = "out_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const outputRef = doc(db, "users", ownerId, "files", fileId, "outputs", outputId);

  const payload = {
    outputId,
    fileId,
    transformation: outputData.transformation,
    title: outputData.title,
    createdBy: user.user_id || "anonymous",
    createdByName: user.name || user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "completed" as const,
    content: outputData.content,
    structuredData: outputData.structuredData || {},
    sources: outputData.sources || [],
  };

  await setDoc(outputRef, payload);

  // Update file document transformations array
  try {
    const fileRef = doc(db, "users", ownerId, "files", fileId);
    const snap = await getDoc(fileRef);
    if (snap.exists()) {
      const existing = snap.data().transformations || [];
      if (!existing.includes(outputData.transformation)) {
        await updateDoc(fileRef, {
          transformations: [...existing, outputData.transformation],
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.warn("[FIRESTORE TRANSFORMATION ARRAY WARNING]:", err);
  }

  // Log activity
  await logFileActivity(ownerId, fileId, "transformed", user, {
    transformation: outputData.transformation,
    title: outputData.title,
  });

  const now = new Date().toISOString();
  return {
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
}

/** 6. Fetch all transformation outputs for a file */
export async function getFileOutputs(ownerId: string, fileId: string): Promise<TransformationOutput[]> {
  try {
    const colRef = collection(db, "users", ownerId, "files", fileId, "outputs");
    const snap = await getDocs(colRef);
    const outputs: TransformationOutput[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      outputs.push({
        outputId: d.outputId || docSnap.id,
        fileId: d.fileId || fileId,
        transformation: d.transformation,
        title: d.title || "",
        createdBy: d.createdBy || "",
        createdByName: d.createdByName || "User",
        createdAt: timestampToISO(d.createdAt),
        updatedAt: timestampToISO(d.updatedAt),
        status: d.status || "completed",
        content: d.content || "",
        structuredData: d.structuredData,
        sources: d.sources,
      });
    });
    return outputs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn("[FIRESTORE GET OUTPUTS WARNING]:", err);
    return [];
  }
}

/** 7. Log file activity */
export async function logFileActivity(
  ownerId: string,
  fileId: string,
  action: ActivityAction,
  actor: User,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const activityId = "act_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const actRef = doc(db, "users", ownerId, "files", fileId, "activity", activityId);

    await setDoc(actRef, {
      activityId,
      fileId,
      actorId: actor.user_id || "anonymous",
      actorName: actor.name || actor.email.split("@")[0],
      actorEmail: actor.email,
      action,
      timestamp: serverTimestamp(),
      metadata,
    });
  } catch (err) {
    console.warn("[FIRESTORE LOG ACTIVITY WARNING]:", err);
  }
}

/** 8. Fetch file activity history */
export async function getFileActivity(ownerId: string, fileId: string): Promise<ActivityRecord[]> {
  try {
    const colRef = collection(db, "users", ownerId, "files", fileId, "activity");
    const snap = await getDocs(colRef);
    const list: ActivityRecord[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        activityId: d.activityId || docSnap.id,
        fileId: d.fileId || fileId,
        actorId: d.actorId || "",
        actorName: d.actorName || "User",
        actorEmail: d.actorEmail || "",
        action: d.action,
        timestamp: timestampToISO(d.timestamp),
        metadata: d.metadata || {},
      });
    });
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn("[FIRESTORE GET ACTIVITY WARNING]:", err);
    return [];
  }
}

/** 9. Share file with target email */
export async function shareFileWithUser(
  ownerId: string,
  fileId: string,
  targetEmail: string,
  permission: "viewer" | "editor",
  currentUser: User
): Promise<SharedUser> {
  const shareId = "share_" + Math.random().toString(36).substring(2, 10);

  const shareRecord: SharedUser = {
    shareId,
    fileId,
    ownerId,
    sharedWithEmail: targetEmail.trim().toLowerCase(),
    sharedWithName: targetEmail.split("@")[0],
    permission,
    sharedBy: currentUser.user_id || "anonymous",
    sharedByName: currentUser.name || currentUser.email,
    sharedAt: new Date().toISOString(),
  };

  // 1. Write to nested shares subcollection
  const nestedShareRef = doc(db, "users", ownerId, "files", fileId, "shares", shareId);
  await setDoc(nestedShareRef, {
    ...shareRecord,
    sharedAt: serverTimestamp(),
  });

  // 2. Write to global lookup collection for fast querying
  const globalShareRef = doc(db, "shares", shareId);
  await setDoc(globalShareRef, {
    ...shareRecord,
    sharedAt: serverTimestamp(),
  });

  // 3. Update file doc's sharedWith list and email arrays for rules & filters
  try {
    const fileRef = doc(db, "users", ownerId, "files", fileId);
    const snap = await getDoc(fileRef);
    if (snap.exists()) {
      const existingShares: SharedUser[] = snap.data().sharedWith || [];
      const updatedShares = existingShares.filter((s) => s.sharedWithEmail !== targetEmail.trim().toLowerCase());
      updatedShares.push(shareRecord);

      const sharedWithEmails = updatedShares.map((s) => s.sharedWithEmail);
      const editorEmails = updatedShares.filter((s) => s.permission === "editor").map((s) => s.sharedWithEmail);

      await updateDoc(fileRef, {
        sharedWith: updatedShares,
        sharedWithEmails,
        editorEmails,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn("[FIRESTORE SHARE ARRAY UPDATE WARNING]:", err);
  }

  // Log activity
  await logFileActivity(ownerId, fileId, "shared", currentUser, { targetEmail, permission });

  return shareRecord;
}

/** 10. Subscribe to user's files and files shared with them */
export function subscribeUserFiles(
  user: User,
  onFilesChanged: (files: AppFile[]) => void
): () => void {
  const userId = user.user_id;
  if (!userId) {
    onFilesChanged([]);
    return () => {};
  }

  const userFilesRef = collection(db, "users", userId, "files");

  const unSubOwner = onSnapshot(
    userFilesRef,
    async (snapshot) => {
      const ownerFiles: AppFile[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        ownerFiles.push({
          id: d.fileId || docSnap.id,
          fileId: d.fileId || docSnap.id,
          filename: d.filename || "file.pdf",
          name: d.title || d.name || d.filename || "Untitled Document",
          title: d.title || d.name || d.filename || "Untitled Document",
          kind: d.kind || getFileKindFromType(d.filename || "", d.fileType || ""),
          extension: d.extension || getFileExtension(d.filename || ""),
          fileType: d.fileType || "application/pdf",
          size: d.size || 0,
          storagePath: d.storagePath,
          downloadUrl: d.downloadUrl,
          ownerId: d.ownerId || userId,
          ownerName: d.ownerName || user.name || user.email.split("@")[0],
          ownerEmail: d.ownerEmail || user.email,
          createdAt: timestampToISO(d.createdAt),
          updatedAt: timestampToISO(d.updatedAt),
          lastOpenedAt: timestampToISO(d.lastOpenedAt),
          status: d.status || "ready",
          pageCount: d.pageCount || 1,
          transformations: d.transformations || [],
          sharedWith: d.sharedWith || [],
          source: d.source || "upload",
          starred: d.starred || false,
          modified: timestampToISO(d.updatedAt),
          owner: d.ownerName || user.name || "You",
        });
      });

      // Also query shared files where user's email is in sharedWith
      try {
        if (user.email) {
          const sharesQuery = query(collection(db, "shares"), where("sharedWithEmail", "==", user.email.toLowerCase()));
          const sharesSnap = await getDocs(sharesQuery);
          const sharedFilePromises: Promise<AppFile | null>[] = [];

          sharesSnap.forEach((sSnap) => {
            const sData = sSnap.data();
            if (sData.ownerId && sData.fileId) {
              const sharedDocRef = doc(db, "users", sData.ownerId, "files", sData.fileId);
              sharedFilePromises.push(
                getDoc(sharedDocRef).then((fSnap) => {
                  if (fSnap.exists()) {
                    const fd = fSnap.data();
                    return {
                      id: fd.fileId || fSnap.id,
                      fileId: fd.fileId || fSnap.id,
                      filename: fd.filename || "shared.pdf",
                      name: fd.title || fd.name || fd.filename || "Shared Document",
                      title: fd.title || fd.name || fd.filename || "Shared Document",
                      kind: fd.kind || getFileKindFromType(fd.filename || "", fd.fileType || ""),
                      extension: fd.extension || getFileExtension(fd.filename || ""),
                      fileType: fd.fileType || "application/pdf",
                      size: fd.size || 0,
                      storagePath: fd.storagePath,
                      downloadUrl: fd.downloadUrl,
                      ownerId: fd.ownerId,
                      ownerName: fd.ownerName || "Collaborator",
                      ownerEmail: fd.ownerEmail || "",
                      createdAt: timestampToISO(fd.createdAt),
                      updatedAt: timestampToISO(fd.updatedAt),
                      lastOpenedAt: timestampToISO(fd.lastOpenedAt),
                      status: fd.status || "ready",
                      pageCount: fd.pageCount || 1,
                      transformations: fd.transformations || [],
                      sharedWith: fd.sharedWith || [],
                      source: "shared" as const,
                      starred: fd.starred || false,
                      modified: timestampToISO(fd.updatedAt),
                      owner: fd.ownerName || "Collaborator",
                    };
                  }
                  return null;
                })
              );
            }
          });

          const sharedFilesResults = await Promise.all(sharedFilePromises);
          const validSharedFiles = sharedFilesResults.filter((f): f is AppFile => f !== null);

          // Combine owner + shared files without duplicates
          const fileMap = new Map<string, AppFile>();
          ownerFiles.forEach((f) => fileMap.set(f.fileId, f));
          validSharedFiles.forEach((f) => {
            if (!fileMap.has(f.fileId)) fileMap.set(f.fileId, f);
          });

          onFilesChanged(Array.from(fileMap.values()));
          return;
        }
      } catch (err) {
        console.warn("[FIRESTORE SHARED FILES QUERY WARNING]:", err);
      }

      onFilesChanged(ownerFiles);
    },
    (err) => {
      console.warn("[FIRESTORE LISTEN FILES ERROR]:", err);
    }
  );

  return () => {
    unSubOwner();
  };
}

/** 11. Delete file document and storage binary */
export async function deleteFileRecord(ownerId: string, fileId: string, storagePath?: string, actor?: User): Promise<void> {
  if (storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn("[FIREBASE STORAGE DELETE WARNING]:", err);
    }
  }

  const fileRef = doc(db, "users", ownerId, "files", fileId);
  await deleteDoc(fileRef);

  if (actor) {
    await logFileActivity(ownerId, fileId, "archived", actor);
  }
}

/** 12. Archive file record */
export async function archiveFileRecord(ownerId: string, fileId: string, actor: User): Promise<void> {
  const fileRef = doc(db, "users", ownerId, "files", fileId);
  await updateDoc(fileRef, {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
  await logFileActivity(ownerId, fileId, "archived", actor);
}
