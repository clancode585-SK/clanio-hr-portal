import { getCookie, removeCookie } from "./cookies";

const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/hrms";
const API_BASE = rawBase.endsWith("/hrms") ? rawBase : `${rawBase.replace(/\/$/, "")}/hrms`;

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined"
    ? (getCookie("token") || localStorage.getItem("token"))
    : null;

  let companyId = typeof window !== "undefined"
    ? (getCookie("company_id") || localStorage.getItem("company_id"))
    : null;

  if (!companyId || companyId === "1" || companyId === "null" || companyId === "undefined") {
    companyId = "2";
  }

  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(companyId ? { "X-Company-Id": companyId } : {}),
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
    let errorMessage = errorData.message || "An error occurred with the request.";
    if (errorData.errors && typeof errorData.errors === "object") {
      const details = Object.values(errorData.errors).flat().join(" ");
      if (details) {
        errorMessage = `${errorMessage} ${details}`;
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export function extractList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.data)) return res.data.data;
  return [];
}
