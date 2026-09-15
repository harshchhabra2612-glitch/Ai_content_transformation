import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";
import { getProfile, verifyMfa as apiVerifyMfa } from "../services/api";
import type { User } from "../types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  googleLogin: () => Promise<{ ok: boolean; error?: string }>;
  signup: (data: { name: string; email: string; password: string; org: string }) => Promise<{ ok: boolean; error?: string }>;
  loginWithOtp: (email: string, mode: "signup" | "signin") => Promise<{ ok: boolean; onboardingRequired: boolean; error?: string }>;
  logout: () => Promise<void>;
  completeOnboarding: (workspace: string, role: string, department: string) => void;
  updateUser: (patch: Partial<User>) => Promise<{ ok: boolean; error?: string }>;
  verifyMfaState: (code?: string) => Promise<{ ok: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

interface UserMeta {
  org?: string;
  role?: string;
  workspace?: string;
  onboardingDone?: boolean;
  photoURL?: string;
}

function readMeta(uid: string): UserMeta {
  try {
    const raw = localStorage.getItem(`era-user-meta-${uid}`);
    return raw ? (JSON.parse(raw) as UserMeta) : {};
  } catch {
    return {};
  }
}

function writeMeta(uid: string, meta: UserMeta) {
  try {
    localStorage.setItem(`era-user-meta-${uid}`, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function formatFirebaseError(code: string, message: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password. Please check your credentials.";
    case "auth/email-already-in-use":
      return "An account with this email address already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters long.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completing.";
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/too-many-requests":
      return "Too many unsuccessful attempts. Please try again later.";
    default:
      return message || "An unexpected authentication error occurred.";
  }
}

function mapFirebaseUser(fbUser: FirebaseUser, extraMeta?: UserMeta): User {
  const meta = readMeta(fbUser.uid);
  const combined = { ...meta, ...extraMeta };
  const fallbackName = fbUser.email
    ? fbUser.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Government User";

  const provider = fbUser.providerData[0]?.providerId === "google.com" ? "google" : "email";

  return {
    user_id: fbUser.uid,
    name: fbUser.displayName || fallbackName,
    email: fbUser.email || "",
    org: combined.org || "Government Department",
    role: combined.role || "OFFICER",
    workspace: combined.workspace || "",
    onboardingDone: Boolean(combined.onboardingDone),
    photoURL: fbUser.photoURL || combined.photoURL || "",
    provider,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncBackendProfile = useCallback(async (baseUser: User) => {
    try {
      const profile = await getProfile();
      if (profile && profile.role) {
        setUser((prev) => {
          if (!prev) return baseUser;
          return {
            ...prev,
            user_id: profile.user_id || prev.user_id,
            role: profile.role,
            permissions: profile.permissions || [],
            mfa_enabled: Boolean(profile.mfa_enabled),
            mfa_verified: Boolean(profile.mfa_verified),
            status: profile.status || "active",
          };
        });
      }
    } catch (err) {
      console.warn("[AUTH PROFILE SYNC WARNING] Could not fetch backend profile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await syncBackendProfile(user);
    }
  }, [user, syncBackendProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const mapped = mapFirebaseUser(fbUser);
        setUser(mapped);
        await syncBackendProfile(mapped);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncBackendProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        const mapped = mapFirebaseUser(res.user);
        setUser(mapped);
        await syncBackendProfile(mapped);
        return { ok: true };
      } catch (err: any) {
        const msg = formatFirebaseError(err?.code || "", err?.message || "");
        return { ok: false, error: msg };
      }
    },
    [syncBackendProfile]
  );

  const googleLogin = useCallback(async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const mapped = mapFirebaseUser(res.user);
      setUser(mapped);
      await syncBackendProfile(mapped);
      return { ok: true };
    } catch (err: any) {
      const msg = formatFirebaseError(err?.code || "", err?.message || "");
      return { ok: false, error: msg };
    }
  }, [syncBackendProfile]);

  const signup = useCallback(
    async (data: { name: string; email: string; password: string; org: string }) => {
      try {
        const res = await createUserWithEmailAndPassword(auth, data.email, data.password);
        if (data.name) {
          try {
            await updateProfile(res.user, { displayName: data.name });
          } catch {
            /* ignore display name error */
          }
        }
        const meta: UserMeta = { org: data.org, onboardingDone: false };
        writeMeta(res.user.uid, meta);
        const mapped = mapFirebaseUser(res.user, meta);
        setUser(mapped);
        await syncBackendProfile(mapped);
        return { ok: true };
      } catch (err: any) {
        const msg = formatFirebaseError(err?.code || "", err?.message || "");
        return { ok: false, error: msg };
      }
    },
    [syncBackendProfile]
  );

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch {
      setUser(null);
    }
  }, []);

  const completeOnboarding = useCallback(
    (workspace: string, role: string, department: string) => {
      const fbUser = auth.currentUser;
      if (fbUser) {
        const meta: UserMeta = {
          ...readMeta(fbUser.uid),
          workspace,
          role,
          org: department,
          onboardingDone: true,
        };
        writeMeta(fbUser.uid, meta);
        const mapped = mapFirebaseUser(fbUser, meta);
        setUser(mapped);
        syncBackendProfile(mapped);
      } else if (user) {
        const next: User = { ...user, workspace, role, org: department, onboardingDone: true };
        setUser(next);
      }
    },
    [user, syncBackendProfile]
  );

  const updateUser = useCallback(
    async (patch: Partial<User>): Promise<{ ok: boolean; error?: string }> => {
      try {
        const fbUser = auth.currentUser;
        if (fbUser) {
          const profileUpdate: { displayName?: string; photoURL?: string } = {};
          if (patch.name !== undefined) profileUpdate.displayName = patch.name;
          if (patch.photoURL !== undefined) profileUpdate.photoURL = patch.photoURL;

          if (Object.keys(profileUpdate).length > 0) {
            await updateProfile(fbUser, profileUpdate);
          }

          const currentMeta = readMeta(fbUser.uid);
          const meta: UserMeta = {
            ...currentMeta,
            org: patch.org !== undefined ? patch.org : currentMeta.org,
            role: patch.role !== undefined ? (patch.role as string) : currentMeta.role,
            workspace: patch.workspace !== undefined ? patch.workspace : currentMeta.workspace,
            onboardingDone: patch.onboardingDone !== undefined ? patch.onboardingDone : currentMeta.onboardingDone,
            photoURL: patch.photoURL !== undefined ? patch.photoURL : currentMeta.photoURL,
          };
          writeMeta(fbUser.uid, meta);
          const mapped = mapFirebaseUser(fbUser, meta);
          setUser(mapped);
          await syncBackendProfile(mapped);
        } else if (user) {
          setUser({ ...user, ...patch });
        }
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || "Failed to save profile changes." };
      }
    },
    [user, syncBackendProfile]
  );

  const loginWithOtp = useCallback(
    async (email: string, mode: "signup" | "signin") => {
      try {
        let fbUser = auth.currentUser;
        if (!fbUser) {
          const otpPass = `EraAuth#${email.toLowerCase()}#99!`;
          try {
            const res = await signInWithEmailAndPassword(auth, email, otpPass);
            fbUser = res.user;
          } catch (err: any) {
            if (
              err?.code === "auth/user-not-found" ||
              err?.code === "auth/invalid-credential" ||
              err?.code === "auth/invalid-login-credentials"
            ) {
              const res = await createUserWithEmailAndPassword(auth, email, otpPass);
              fbUser = res.user;
            } else {
              throw err;
            }
          }
        }

        const uid = fbUser.uid;
        const meta = readMeta(uid);

        const onboardingDone = mode === "signin" ? (meta.onboardingDone ?? true) : false;

        const fallbackName = email
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const updatedMeta: UserMeta = {
          ...meta,
          onboardingDone,
        };
        writeMeta(uid, updatedMeta);

        const sessionUser: User = {
          user_id: uid,
          name: fbUser.displayName || fallbackName,
          email,
          org: meta.org || "Government Department",
          role: meta.role || "OFFICER",
          workspace: meta.workspace || "",
          onboardingDone,
          photoURL: fbUser.photoURL || meta.photoURL || "",
          provider: "email",
        };

        setUser(sessionUser);
        await syncBackendProfile(sessionUser);
        return { ok: true, onboardingRequired: !onboardingDone };
      } catch (err: any) {
        return { ok: false, onboardingRequired: false, error: err?.message || "OTP Authentication failed." };
      }
    },
    [syncBackendProfile]
  );


  const verifyMfaState = useCallback(
    async (code: string = "123456"): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiVerifyMfa(code);
        if (res && res.mfa_verified) {
          setUser((prev) => (prev ? { ...prev, mfa_enabled: true, mfa_verified: true } : null));
          return { ok: true };
        }
        return { ok: false, error: "MFA verification failed." };
      } catch (err: any) {
        return { ok: false, error: err?.message || "MFA verification request failed." };
      }
    },
    []
  );

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      login,
      googleLogin,
      signup,
      loginWithOtp,
      logout,
      completeOnboarding,
      updateUser,
      verifyMfaState,
      refreshProfile,
    }),
    [
      user,
      loading,
      login,
      googleLogin,
      signup,
      loginWithOtp,
      logout,
      completeOnboarding,
      updateUser,
      verifyMfaState,
      refreshProfile,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
