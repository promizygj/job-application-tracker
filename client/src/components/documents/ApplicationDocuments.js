"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DOCUMENT_TYPES, documentErrorMessage, formatBytes } from "@/lib/documents";
import { labelOf } from "@/lib/constants";
import { useAttachDocumentMutation, useDetachDocumentMutation, useGetMeQuery, useListDocumentsQuery } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";
import { useOpenDocument } from "./DocumentsView";
import { UploadDialog } from "./UploadDialog";

/** Documents tab on the application page: what was sent with this application (DOC-3). */
export function ApplicationDocuments({ app }) {
  const toast = useToast();
  const open = useOpenDocument();
  const { data: me } = useGetMeQuery();
  const { data: library = [] } = useListDocumentsQuery();
  const [attachDocument, { isLoading: attaching }] = useAttachDocumentMutation();
  const [detachDocument] = useDetachDocumentMutation();
  const [choice, setChoice] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const attachedIds = new Set(app.documents.map((d) => d.id));
  const available = library.filter((d) => !attachedIds.has(d.id));
  const options = available.map((d) => ({
    value: d.id,
    label: `${d.name} v${d.version}${d.isDefault ? " (default)" : ""} · ${labelOf(DOCUMENT_TYPES, d.type)}`,
  }));

  async function attach(documentId, label) {
    try {
      await attachDocument({ applicationId: app.id, documentId }).unwrap();
      toast(`Attached ${label}`);
      setChoice("");
    } catch (err) {
      toast(documentErrorMessage(err), "error");
    }
  }

  async function detach(doc) {
    try {
      await detachDocument({ applicationId: app.id, documentId: doc.id }).unwrap();
      toast(`Removed ${doc.name} v${doc.version} from this application`);
    } catch (err) {
      toast(documentErrorMessage(err), "error");
    }
  }

  return (
    <div className="space-y-4">
      {app.documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">
          No documents attached. Attach the CV and cover letter you sent, so you know which version went where.
        </p>
      ) : (
        <ul className="divide-y divide-line-subtle card">
          {app.documents.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center">
              <span aria-hidden>{d.type === "COVER_LETTER" ? "📝" : "📄"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {d.name} <span className="text-slate-500">v{d.version}</span>
                </p>
                <p className="truncate text-slate-500">
                  {labelOf(DOCUMENT_TYPES, d.type)} · {d.fileName} · {formatBytes(d.sizeBytes)}
                </p>
              </div>
              <div className="flex gap-1">
                {d.mimeType === "application/pdf" && (
                  <button onClick={() => open(d, true)} className="rounded px-2 py-1 text-slate-700 hover:bg-subtle">Preview</button>
                )}
                <button onClick={() => open(d, false)} className="rounded px-2 py-1 text-slate-700 hover:bg-subtle">Download</button>
                <button onClick={() => detach(d)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50">Detach</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 card p-4 sm:flex-row sm:items-end">
        {options.length > 0 ? (
          <>
            <Select
              label="Attach from your library"
              className="flex-1"
              placeholder="Choose a document…"
              options={options}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            />
            <Button
              onClick={() => {
                const doc = available.find((d) => d.id === choice);
                attach(choice, `${doc.name} v${doc.version}`);
              }}
              disabled={!choice}
              loading={attaching}
            >
              Attach
            </Button>
          </>
        ) : (
          <p className="flex-1 text-sm text-slate-500">
            {library.length ? "Every document in your library is attached." : "Your document library is empty."}{" "}
            <Link href="/documents" className="text-brand-600 hover:underline">Manage documents</Link>
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => setUploadOpen(true)}
          disabled={!me?.emailVerified}
          title={me?.emailVerified ? undefined : "Verify your email to upload"}
        >
          ⬆ Upload &amp; attach
        </Button>
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(doc) => attach(doc.id, `${doc.name} v${doc.version}`)}
      />
    </div>
  );
}
