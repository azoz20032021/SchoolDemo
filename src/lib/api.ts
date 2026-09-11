/**
 * Single entry point for every call to the API.
 *
 * Before this, each component called `fetch` directly and ignored the response
 * status, so a failed save looked exactly like a successful one. Everything now
 * goes through here: the session token is attached automatically, errors become
 * real exceptions carrying the server's Arabic message, and an expired session
 * signs the user out instead of silently returning empty lists.
 */

import { DemoError, handle } from "../demo/server";

const TOKEN_KEY = "school_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/** Fired when the server rejects our token; AuthContext listens and logs out. */
export const SESSION_EXPIRED_EVENT = "school:session-expired";

let token: string | null = null;
let apiLang = "ar";

/** Tells the API which language to return its messages in. */
export function setApiLang(lang: string): void {
  apiLang = lang;
}

export function getToken(): string | null {
  if (token === null) {
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
  }
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing — the in-memory copy still works for this tab */
  }
}

/* ------------------------------------------------------------------ *
 * GET de-duplication
 *
 * Several panels mount at once and ask for the same list. Sharing the in-flight
 * promise turns those into one network request.
 * ------------------------------------------------------------------ */

const inflight = new Map<string, Promise<any>>();

/**
 * In this build there is no server.
 *
 * The production system answers these calls from an Express API over Firestore.
 * This is the demo, and it answers them from a world generated in the browser —
 * so the whole product runs as a static site with no backend, no database and
 * no keys to leak. Everything above and below this function is untouched, and
 * so is every screen: the substitution happens here, at the one point where the
 * application reaches for the network.
 *
 * A short delay is deliberate. Answering instantly makes an interface feel
 * wrong in a way people notice but cannot name, because nothing real is ever
 * that fast, and it would hide the loading states this application actually has.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 90 + Math.random() * 160));

  try {
    return (await handle(method, path, body)) as T;
  } catch (err) {
    const status = err instanceof DemoError ? err.status : 500;

    if (status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    throw new ApiError(status, err instanceof Error ? err.message : "Request failed");
  }
}

export const api = {
  get<T = any>(path: string): Promise<T> {
    const key = apiLang + " " + path;
    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = request<T>("GET", path).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  },
  post: <T = any>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T = any>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  del: <T = any>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

/* ------------------------------------------------------------------ *
 * Formatting helpers shared by the finance screens
 * ------------------------------------------------------------------ */

/** Currency suffix and date locale follow the active interface language. */
export function currencyLabel(): string {
  return apiLang === "en" ? "IQD" : "د.ع";
}

function locale(): string {
  return apiLang === "en" ? "en-GB" : "ar-EG";
}

export function formatMoney(amount: number | null | undefined): string {
  const value = Number(amount || 0);
  return `${value.toLocaleString("en-US")} ${currencyLabel()}`;
}

export function formatDate(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  const seconds = (value as any)?.seconds;
  if (typeof seconds === "number") {
    return new Date(seconds * 1000).toLocaleDateString(locale());
  }
  return "—";
}

/** Just the clock, for a message bubble. */
export function formatTime(value: unknown): string {
  const seconds = (value as any)?.seconds;
  if (typeof seconds !== "number") return "";
  return new Date(seconds * 1000).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The day a message belongs to: today and yesterday said in words. */
export function formatDay(value: unknown): string {
  const seconds = (value as any)?.seconds;
  if (typeof seconds !== "number") return "";

  const date = new Date(seconds * 1000);
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86400000);

  if (days === 0) return apiLang === "en" ? "Today" : "اليوم";
  if (days === 1) return apiLang === "en" ? "Yesterday" : "أمس";

  return date.toLocaleDateString(locale(), { day: "numeric", month: "long" });
}

export function formatDateTime(value: unknown): string {
  const seconds = (value as any)?.seconds;
  if (typeof seconds !== "number") return typeof value === "string" ? value : "—";
  return new Date(seconds * 1000).toLocaleString(locale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
