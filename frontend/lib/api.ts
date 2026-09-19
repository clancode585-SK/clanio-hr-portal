import { getCookie, removeCookie } from "./cookies";

const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/hrms";
const API_BASE = rawBase.endsWith("/hrms") ? rawBase : `${rawBase.replace(/\/$/, "")}/hrms`;

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined"
    ? (getCookie("token") || localStorage.getItem("token"))
    : null;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      removeCookie("token");
      removeCookie("isAuthenticated");
      localStorage.removeItem("token");
      localStorage.removeItem("isAuthenticated");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "An error occurred with the request.");
  }

  return response.json();
}
