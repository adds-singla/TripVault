import { authHeaders } from "./session";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()), ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(init.json); }
  const res = await fetch(`/api${path}`, { ...init, headers, body });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg: string }) => x.msg).join(", ") : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/** Upload a file straight to S3 using a pre-signed URL from the API; returns the s3 key. */
export async function uploadFile(tripId: string, file: File, kind: "documents" | "receipts" | "photos"): Promise<string> {
  const p = await api<{ upload_url: string; s3_key: string; headers: Record<string, string> }>(
    `/trips/${tripId}/documents/presign-upload`,
    { method: "POST", json: { filename: file.name, content_type: file.type, size: file.size, kind } });
  const put = await fetch(p.upload_url, { method: "PUT", headers: p.headers, body: file });
  if (!put.ok) throw new ApiError(put.status, "Upload to storage failed");
  return p.s3_key;
}
