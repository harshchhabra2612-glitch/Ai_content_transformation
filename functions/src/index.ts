import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { Resend } from "resend";
import * as crypto from "crypto";

initializeApp();
const db = getFirestore();

// Define Firebase Secret for Resend API Key
const resendSecret = defineSecret("RESEND_API_KEY");

function hashOtp(email: string, otp: string): string {
  return crypto
    .createHash("sha256")
    .update(`${otp}:${email.toLowerCase().trim()}:ERA_OTP_SALT_2026`)
    .digest("hex");
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Send OTP Cloud Function
 * Generates 6-digit OTP, hashes it, stores in Firestore, and sends via Resend.
 */
export const sendOtp = onCall(
  { secrets: [resendSecret], cors: true },
  async (request) => {
    const email = (request.data?.email || "").toLowerCase().trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Please enter a valid work email address.");
    }

    const docRef = db.collection("otps").doc(email);
    const docSnap = await docRef.get();
    const now = Date.now();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.lastSentAt && now - data.lastSentAt < 60000) {
        const remaining = Math.ceil((60000 - (now - data.lastSentAt)) / 1000);
        throw new HttpsError(
          "resource-exhausted",
          `Please wait ${remaining} seconds before requesting a new code.`
        );
      }
    }

    const otpCode = generateOtp();
    const otpHash = hashOtp(email, otpCode);
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes

    await docRef.set({
      otpHash,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
      used: false,
      updatedAt: now,
    });

    const apiKey = resendSecret.value() || process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Email delivery service configuration error.");
    }

    const resend = new Resend(apiKey);

    try {
      await resend.emails.send({
        from: "ERA <onboarding@resend.dev>",
        to: [email],
        subject: `${otpCode} is your ERA verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #050716; color: #ffffff; border-radius: 16px;">
            <div style="margin-bottom: 24px;">
              <span style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 8px 14px; border-radius: 10px; font-weight: 800; font-size: 18px; color: #ffffff;">ERA</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #ffffff;">Verify your email</h2>
            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5;">Enter the following 6-digit verification code to complete your sign-in to ERA.</p>
            <div style="background-color: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #818cf8;">${otpCode}</span>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">This code will expire in <strong>5 minutes</strong>. If you did not request this code, please ignore this email.</p>
          </div>
        `,
      });

      return { ok: true };
    } catch (err: any) {
      console.error("Resend delivery failed:", err);
      throw new HttpsError("internal", err?.message || "Couldn't send the code. Please try again.");
    }
  }
);

/**
 * Verify OTP Cloud Function
 * Verifies submitted OTP against SHA-256 hash in Firestore. Enforces single-use & 5 max attempts.
 */
export const verifyOtp = onCall(
  { cors: true },
  async (request) => {
    const email = (request.data?.email || "").toLowerCase().trim();
    const otp = (request.data?.otp || "").trim();

    if (!email || !otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      throw new HttpsError("invalid-argument", "Please enter a valid 6-digit verification code.");
    }

    const docRef = db.collection("otps").doc(email);
    const docSnap = await docRef.get();
    const now = Date.now();

    if (!docSnap.exists) {
      throw new HttpsError("not-found", "No verification code found. Please request a new code.");
    }

    const data = docSnap.data()!;

    if (data.used) {
      throw new HttpsError("failed-precondition", "This code has already been used. Request a new code.");
    }

    if (data.attempts >= 5) {
      throw new HttpsError("resource-exhausted", "Too many attempts. Please request a new code.");
    }

    if (now > data.expiresAt) {
      throw new HttpsError("deadline-exceeded", "This code has expired. Request a new code.");
    }

    const submittedHash = hashOtp(email, otp);

    if (submittedHash !== data.otpHash) {
      const newAttempts = (data.attempts || 0) + 1;
      await docRef.update({ attempts: newAttempts });

      if (newAttempts >= 5) {
        throw new HttpsError("resource-exhausted", "Too many attempts. Please request a new code.");
      }

      throw new HttpsError("invalid-argument", "Incorrect code. Please try again.");
    }

    // Single-use OTP: mark as used
    await docRef.update({ used: true });

    return { ok: true };
  }
);
