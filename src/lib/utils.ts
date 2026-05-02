import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i

export function getApiBaseUrl() {
  const base = String(import.meta.env.VITE_API_BASE_URL ?? "").trim()
  return base.replace(/\/+$/, "")
}

export function resolveAssetUrl(path?: string | null) {
  if (!path) return null

  const value = String(path).trim()
  if (!value) return null

  if (
    ABSOLUTE_URL_RE.test(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value
  }

  const base = getApiBaseUrl()
  const normalizedPath = value.startsWith("/") ? value : `/${value}`

  return base ? `${base}${normalizedPath}` : normalizedPath
}
