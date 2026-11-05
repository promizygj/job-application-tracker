"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { Alert } from "@/components/ui/Alert";
import { DOCUMENT_TYPES, documentErrorMessage, formatBytes, openDocument } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { labelOf } from "@/lib/constants";
import { useDeleteDocumentMutation, useGetMeQuery, useListDocumentsQuery, useUpdateDocumentMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";
import { UploadDialog } from "./UploadDialog";

const FILTERS = [{ value: "", label: "All" }, ...DOCUMENT_TYPES.map((t) => ({ ...t, label: t.value === "CV" ? "CVs" : t.value === "COVER_LETTER" ? "Cover letters" : "Other" }))];

/** Shared Preview / Download buttons. */
export function useOpenDocument() {
  const toast = useToast();
  return async (doc, inline) => {
    try {
      await openDocument(doc.id, { inline });
    } catch (err) {
      toast(documentErrorMessage(err, "Couldn't open the file."), "error");
    }
  };
}

function EditDialog({ doc, onClose }) {
  const toast = useToast();
  const [updateDocument, { isLoading }] = useUpdateDocumentMutation();
  const [name, setName] = useState(doc?.name ?? "");
  const [notes, setNotes] = useState(doc?.notes ?? "");
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    try {
      const body = { notes: notes.trim(), ...(name.trim() !== doc.name && { name: name.trim() }) };
      const updated = await updateDocument({ id: doc.id, ...body }).unwrap();
      toast(updated.name !== doc.name ? `Moved to “${updated.name}” as v${updated.version}` : "Saved");
      onClose();
    } catch (err) {
      setError(documentErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        hint="Using another document's name makes this its newest version."
      />
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button type="submit" loading={isLoading}>Save</Button>
      </div>
    </form>
  );
}

function VersionRow({ doc, onEdit, onDelete }) {
  const open = useOpenDocument();
  const toast = useToast();
  const [updateDocument, { isLoading }] = useUpdateDocumentMutation();
  const isPdf = doc.mimeType === "application/pdf";

  async function makeDefault() {
    try {
      await updateDocument({ id: doc.id, isDefault: true }).unwrap();
      toast(`v${doc.version} is now the default “${doc.name}”`);
    } catch (err) {
      toast(documentErrorMessage(err), "error");
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-8 shrink-0 font-semibold text-slate-700">v{doc.version}</span>
        <div className="min-w-0">
          <p className="truncate">
            {doc.fileName}
            {doc.isDefault && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">★ Default</span>}
          </p>
          <p className="text-xs text-slate-500">
            {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt, { timeZone: undefined })} · used in {doc.usedInCount} application
            {doc.usedInCount === 1 ? "" : "s"}
            {doc.notes && <> · {doc.notes}</>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 sm:justify-end">
        {!doc.isDefault && (
          <button onClick={makeDefault} disabled={isLoading} className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Make default</button>
        )}
        {isPdf && <button onClick={() => open(doc, true)} className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Preview</button>}
        <button onClick={() => open(doc, false)} className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Download</button>
        <button onClick={() => onEdit(doc)} className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Rename</button>
        <button onClick={() => onDelete(doc)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50">Delete</button>
      </div>
    </li>
  );
}

export function DocumentsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const type = params.get("type") ?? "";
  const { data: me } = useGetMeQuery();
  // currentData: only results for the selected tab (never the previous tab's list while loading).
  const { currentData: docs, isFetching, isError, refetch } = useListDocumentsQuery(type ? { type } : undefined);
  const isLoading = !docs && isFetching;
  const [deleteDocument, { isLoading: deleting }] = useDeleteDocumentMutation();
  const [upload, setUpload] = useState(null); // { preset? } when open
  const [editing, setEditing] = useState(null);
  const [toDelete, setDeleting] = useState(null); // { doc, inUse? }

  const verified = me?.emailVerified;

  // Group versions under their (type, name); the API already sorts by type, name, newest version.
  const groups = [];
  for (const d of docs ?? []) {
    const key = `${d.type}|${d.name}`;
    if (groups.at(-1)?.key !== key) groups.push({ key, type: d.type, name: d.name, versions: [] });
    groups.at(-1).versions.push(d);
  }

  async function confirmDelete() {
    const { doc, inUse } = toDelete;
    try {
      await deleteDocument({ id: doc.id, force: Boolean(inUse) }).unwrap();
      toast(`Deleted ${doc.name} v${doc.version}`);
      setDeleting(null);
    } catch (err) {
      if (err?.data?.error?.code === "DOCUMENT_IN_USE") {
        setDeleting({ doc, inUse: err.data.error.message }); // ask again, then force
      } else {
        toast(documentErrorMessage(err), "error");
        setDeleting(null);
      }
    }
  }

  const setType = (t) => {
    const next = new URLSearchParams(params);
    if (t) next.set("type", t);
    else next.delete("type");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <button
          onClick={() => setUpload({})}
          disabled={!verified}
          title={verified ? undefined : "Verify your email to upload"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          ⬆ Upload
        </button>
      </div>
      {me && !verified && <Alert type="warning">Verify your email address to upload documents. Use the link in the banner above to resend it.</Alert>}

      <div role="tablist" aria-label="Document type" className="flex gap-1 border-b border-slate-200">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={type === f.value}
            onClick={() => setType(f.value)}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 aria-selected:border-indigo-600 aria-selected:text-indigo-700"
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load your documents." onRetry={refetch} />
      ) : groups.length === 0 ? (
        <EmptyState
          title={type ? "No documents of this type yet" : "No documents yet"}
          action={
            verified && (
              <button onClick={() => setUpload({})} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Upload your CV
              </button>
            )
          }
        >
          Keep each CV and cover letter here. Upload new versions as you tailor them, and attach them to the applications they were sent with.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.name} className="rounded-lg border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span aria-hidden>{g.type === "COVER_LETTER" ? "📝" : "📄"}</span>
                <h2 className="font-medium">{g.name}</h2>
                <Tag>{labelOf(DOCUMENT_TYPES, g.type)}</Tag>
                <span className="text-xs text-slate-500">
                  {g.versions.length} version{g.versions.length > 1 ? "s" : ""}
                </span>
                {verified && (
                  <button onClick={() => setUpload({ preset: { type: g.type, name: g.name } })} className="ml-auto rounded px-2 py-1 text-sm text-indigo-600 hover:bg-indigo-50">
                    + New version
                  </button>
                )}
              </header>
              <ul className="divide-y divide-slate-100">
                {g.versions.map((d) => (
                  <VersionRow key={d.id} doc={d} onEdit={setEditing} onDelete={(doc) => setDeleting({ doc })} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <UploadDialog open={Boolean(upload)} onClose={() => setUpload(null)} preset={upload?.preset} />
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Rename ${editing.name} v${editing.version}` : ""}>
        {editing && <EditDialog key={editing.id} doc={editing} onClose={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={toDelete?.inUse ? "This document is in use" : "Delete this document?"}
        confirmLabel={toDelete?.inUse ? "Delete anyway" : "Delete"}
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {toDelete?.inUse
          ? `${toDelete.inUse} It will be removed from those applications.`
          : `${toDelete?.doc.name} v${toDelete?.doc.version} (${toDelete?.doc.fileName}) will be permanently deleted.`}
      </ConfirmDialog>
    </div>
  );
}
