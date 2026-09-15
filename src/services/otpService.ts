export interface OtpResponse {
  ok: boolean;
  error?: string;
  devOtp?: string;
}

/**
 * DEMO / DEVELOPMENT ONLY OTP SERVICE
 * Removes dependency on Firebase Cloud Functions, Resend API, and Firebase Blaze billing.
 */

export const DEMO_OTP = "123456";

/**
 * Send a demo OTP code to the provided email address
 */
export async function sendOtp(email: string): Promise<OtpResponse> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: "Please enter a valid work email address." };
  }

  // Simulate brief async delay for realistic UX
  await new Promise((resolve) => setTimeout(resolve, 400));

  console.log(`%c[DEMO OTP SERVICE] Code sent to ${cleanEmail}: ${DEMO_OTP}`, "color: #8b5cf6; font-weight: bold; font-size: 14px;");

  return { ok: true, devOtp: DEMO_OTP };
}

/**
 * Verify a 6-digit OTP code (Demo OTP: 123456)
 */
export async function verifyOtp(_email: string, otp: string): Promise<OtpResponse> {
  const cleanOtp = otp.trim();

  if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return { ok: false, error: "Please enter a valid 6-digit verification code." };
  }

  // Simulate brief async delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (cleanOtp === DEMO_OTP) {
    return { ok: true };
  }

  if (cleanOtp === "000000") {
    return { ok: false, error: "This code has expired. Request a new code." };
  }

  if (cleanOtp === "999999") {
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }

  return { ok: false, error: "Incorrect code. Please try again." };
}

/**
 * Resend an OTP code to the provided email address
 */
export async function resendOtp(email: string): Promise<OtpResponse> {
  return sendOtp(email);
}
