"use client";

import { api } from "@/lib/api";

export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EXTENSIONS = /\.(pdf|docx?)$/i;

export const DOCUMENT_TYPES = [
  { value: "CV", label: "CV / résumé" },
  { value: "COVER_LETTER", label: "Cover letter" },
  { value: "OTHER", label: "Other" },
];

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Quick checks before uploading. The server still checks the real file contents. */
export function checkFile(file) {
  if (!EXTENSIONS.test(file.name)) return "Only PDF, DOC and DOCX files can be uploaded.";
  if (file.size > MAX_BYTES) return `This file is ${formatBytes(file.size)}. The limit is 5 MB.`;
  if (file.size === 0) return "This file is empty.";
  return null;
}

/** Uploads with progress (0–100). Resolves to the created document. */
export async function uploadDocument({ file, type, name, notes }, onProgress) {
  const form = new FormData();
  form.append("type", type);
  form.append("name", name);
  if (notes) form.append("notes", notes);
  form.append("file", file);
  const res = await api.post("/documents", form, {
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  });
  return res.data.data.document;
}

/**
 * Opens (PDF in a new tab) or downloads a document via a short-lived signed link.
 * The tab is opened before the request so pop-up blockers treat it as part of the click.
 */
export async function openDocument(id, { inline = false } = {}) {
  const tab = inline ? window.open("", "_blank") : null;
  try {
    const res = await api.get(`/documents/${id}/download`, { params: inline ? { inline: true } : undefined });
    const { url } = res.data.data;
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** API error → message, for axios errors (uploads/downloads) and RTK Query errors alike. */
export function documentErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.error?.message ?? err?.data?.error?.message ?? fallback;
}
