import { auth } from "./firebase";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function resolveMediaUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${API_URL}${cleanUrl}`;
}

export interface ChatOptions {
  document_id?: string;
  question?: string;
  transformation?: string;
  tone?: string;
  length?: string;
  audience?: string;
  theme?: string;
  language?: string;
  instructions?: string;
}

export interface AiConfig {
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AiMetrics {
  model: string;
  temperature: number;
  max_tokens: number;
  usage: TokenUsage;
  latency_ms: number;
}

export async function getAiConfig(): Promise<AiConfig> {
  const response = await fetch(`${API_URL}/api/ai/config`);
  return handleResponse(response);
}

async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extraHeaders };
  const user = auth.currentUser;
  console.log(`[AUTH] user authenticated: ${Boolean(user)}`);

  if (user) {
    try {
      const token = await user.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (err) {
      console.warn("[ERA API SECURITY] Could not fetch fresh Firebase ID Token:", err);
    }
  }
  return headers;
}

async function handleResponse(response: Response) {
  let responseData: any = {};
  try {
    responseData = await response.json();
  } catch {
    /* non-json response */
  }

  if (!response.ok) {
    const errorMsg =
      responseData?.detail || responseData?.message || `Request failed with HTTP status ${response.status}`;

    if (response.status === 401) {
      console.error("[ERA API SECURITY] 401 Unauthorized:", errorMsg);
    } else if (response.status === 403) {
      console.error("[ERA API SECURITY] 403 Forbidden:", errorMsg);
    }

    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.detail = responseData?.detail;
    throw err;
  }

  return responseData;
}

export async function checkBackend() {
  const response = await fetch(`${API_URL}/health`);
  return handleResponse(response);
}

export async function getProfile() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/user/profile`, { headers });
  return handleResponse(response);
}

export async function verifyMfa(code: string = "123456") {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${API_URL}/api/user/mfa/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code }),
  });
  return handleResponse(response);
}

export async function uploadDocument(file: File) {
  const uploadUrl = `${API_URL}/api/upload`;

  if (!(file instanceof File)) {
    console.error("[UPLOAD ERROR] Invalid file instance passed:", file);
    throw new Error("Invalid file object: Not a browser File instance");
  }

  const headers = await getAuthHeaders();
  const hasAuthHeader = Boolean(headers["Authorization"]);

  console.log(`[UPLOAD] API URL: ${uploadUrl}`);
  console.log(`[UPLOAD] Authorization header present: ${hasAuthHeader}`);

  const formData = new FormData();
  formData.append("file", file, file.name);

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch (netErr: any) {
    console.error("[UPLOAD FETCH NETWORK ERROR]:", netErr);
    throw new Error(`Network connection error to ${uploadUrl}: ${netErr.message || netErr}`);
  }

  console.log(`[UPLOAD] HTTP Status: ${response.status} ${response.statusText}`);

  return handleResponse(response);
}

export async function sendChatMessage(options: string | ChatOptions) {
  const payload = typeof options === "string" ? { question: options } : options;
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });

  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function getDocuments() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/documents`, { headers });
  return handleResponse(response);
}

export async function downloadDocument(documentId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/documents/${documentId}`, { headers });
  if (!response.ok) {
    return handleResponse(response);
  }
  return response.blob();
}

export async function deleteDocument(documentId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse(response);
}

export async function shareDocument(documentId: string, targetUserId: string) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${API_URL}/api/documents/${documentId}/share`, {
    method: "POST",
    headers,
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
  return handleResponse(response);
}

export async function getAdminUsers() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/users`, { headers });
  return handleResponse(response);
}

export async function updateUserRole(targetUserId: string, newRole: string) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${API_URL}/api/admin/users/${targetUserId}/role`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ role: newRole }),
  });
  return handleResponse(response);
}

export async function getAuditLogs() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/audit-logs`, { headers });
  return handleResponse(response);
}

export interface EditTransformationOptions {
  document_id: string;
  transformation_id: string;
  current_output: string | Record<string, any>;
  instruction: string;
  options?: Record<string, any>;
}

export async function editTransformation(params: EditTransformationOptions) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${API_URL}/api/transformations/edit`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  return handleResponse(response);
}

export interface MediaGenerationOptions {
  prompt: string;
  document_id?: string;
  options?: {
    aspect_ratio?: string;
    style?: string;
    quality?: string;
    duration?: string;
  };
}

export async function generateGeminiImage(params: MediaGenerationOptions) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${API_URL}/api/generate-image`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  return handleResponse(response);
}

export async function generateImageApi(params: { prompt: string; document_id?: string; options?: any }) {
  return generateGeminiImage(params);
}

export async function generateGeminiVideo(params: MediaGenerationOptions) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${API_URL}/api/media/video/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  return handleResponse(response);
}

export async function getVideoStatus(operationId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/media/video/status/${encodeURIComponent(operationId)}`, {
    headers,
  });
  return handleResponse(response);
}