import { customFetch } from "@workspace/api-client-react";

/**
 * Thin convenience layer over the Orval-generated `customFetch`.
 *
 * - Auto-sets `credentials: "include"` (cookie-based auth).
 * - Provides typed method helpers so callers don't juggle `RequestInit` manually.
 * - Single import: `import { apiClient } from "@/lib/api-client"`.
 *
 * For generated hooks (useGetAdminDashboard, etc.) keep using `@workspace/api-client-react` directly.
 * Use `apiClient` for one-off fetches that don't have a generated hook.
 */

type FetchOptions = Omit<RequestInit, "method">;

function withCredentials(options?: FetchOptions): RequestInit {
  return { credentials: "include", ...options };
}

function withBody(
  method: string,
  body: unknown,
  options?: FetchOptions,
): RequestInit {
  return {
    credentials: "include",
    ...options,
    method,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  };
}

export const apiClient = {
  /** GET — returns parsed response body. */
  get<T = unknown>(url: string, options?: FetchOptions): Promise<T> {
    return customFetch<T>(url, withCredentials(options));
  },

  /** POST with JSON body. */
  post<T = unknown>(url: string, body?: unknown, options?: FetchOptions): Promise<T> {
    if (body === undefined) {
      return customFetch<T>(url, { credentials: "include", method: "POST", ...options });
    }
    return customFetch<T>(url, withBody("POST", body, options));
  },

  /** PUT with JSON body. */
  put<T = unknown>(url: string, body: unknown, options?: FetchOptions): Promise<T> {
    return customFetch<T>(url, withBody("PUT", body, options));
  },

  /** PATCH with JSON body. */
  patch<T = unknown>(url: string, body: unknown, options?: FetchOptions): Promise<T> {
    return customFetch<T>(url, withBody("PATCH", body, options));
  },

  /** DELETE — body is optional. */
  del<T = unknown>(url: string, body?: unknown, options?: FetchOptions): Promise<T> {
    if (body === undefined) {
      return customFetch<T>(url, { credentials: "include", method: "DELETE", ...options });
    }
    return customFetch<T>(url, withBody("DELETE", body, options));
  },

  /** Raw access when you need full control (e.g. FormData upload). */
  fetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
    return customFetch<T>(url, withCredentials(options));
  },
} as const;
