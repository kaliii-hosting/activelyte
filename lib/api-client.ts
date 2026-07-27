// Thin client for the admin API routes. Attaches the current user's Firebase ID
// token as a Bearer credential and normalizes error responses to thrown Errors
// carrying the server's message.

import { currentIdToken } from "./firebase/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = await currentIdToken();
  if (!token) throw new ApiError(401, "You're not signed in.");

  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Request failed.");
  }
  return data as T;
}
