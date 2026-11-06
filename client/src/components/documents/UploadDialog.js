"use client";

import { useId, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ACCEPT, DOCUMENT_TYPES, checkFile, documentErrorMessage, formatBytes, uploadDocument } from "@/lib/documents";
import { DOCUMENTS, apiSlice, useListDocumentsQuery } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

/** Drag-and-drop area that is also a keyboard-accessible file picker. */
function Dropzone({ file, onFile, error }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const id = useId();

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-indigo-300 ${
          over ? "border-indigo-500 bg-indigo-50" : error ? "border-red-400 bg-red-50" : "border-slate-300 hover:bg-slate-50"
        }`}
      >
        <span aria-hidden className="text-2xl">📄</span>
        {file ? (
          <>
            <span className="font-medium break-all">{file.name}</span>
            <span className="text-slate-500">{formatBytes(file.size)} · click or drop to replace</span>
          </>
        ) : (
          <>
            <span className="font-medium">Drop a file here, or click to choose</span>
            <span className="text-slate-500">PDF, DOC or DOCX · up to 4 MB</span>
          </>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files[0]) onFile(e.target.files[0]);
            e.target.value = ""; // allow choosing the same file again
          }}
        />
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Upload a document. `preset` = { type, name } to add a new version of an existing document.
 * `onUploaded(document)` runs after a successful upload (e.g. to attach it to an application).
 */
export function UploadDialog({ open, onClose, preset, onUploaded }) {
  return (
    <Modal open={open} onClose={onClose} title={preset ? `New version of “${preset.name}”` : "Upload document"} size="max-w-lg">
      <UploadForm preset={preset} onClose={onClose} onUploaded={onUploaded} />
    </Modal>
  );
}

function UploadForm({ preset, onClose, onUploaded }) {
  const dispatch = useDispatch();
  const toast = useToast();
  const { data: documents = [] } = useListDocumentsQuery();
  const [file, setFile] = useState(null);
  const [type, setType] = useState(preset?.type ?? "CV");
  const [name, setName] = useState(preset?.name ?? "");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [progress, setProgress] = useState(null); // null = not uploading

  const existingNames = [...new Set(documents.filter((d) => d.type === type).map((d) => d.name))];
  const nextVersion = documents.filter((d) => d.type === type && d.name === name.trim()).reduce((max, d) => Math.max(max, d.version), 0) + 1;

  function chooseFile(f) {
    const problem = checkFile(f);
    setErrors((e) => ({ ...e, file: problem ?? undefined }));
    setFile(problem ? null : f);
    // Suggest a name from the filename for brand-new documents.
    if (!problem && !name.trim()) setName(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 100));
  }

  async function submit(e) {
    e.preventDefault();
    setFormError(null);
    const errs = {};
    if (!file) errs.file = "Choose a file to upload";
    if (!name.trim()) errs.name = "Give it a name, e.g. “Frontend CV”";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setProgress(0);
    try {
      const document = await uploadDocument({ file, type, name: name.trim(), notes: notes.trim() }, setProgress);
      dispatch(apiSlice.util.invalidateTags([DOCUMENTS]));
      toast(`Uploaded ${document.name} v${document.version}`);
      await onUploaded?.(document);
      onClose();
    } catch (err) {
      setFormError(documentErrorMessage(err));
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const listId = `doc-names-${type}`;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert type="error">{formError}</Alert>}
      <Dropzone file={file} onFile={chooseFile} error={errors.file} />
      {!preset && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Type" options={DOCUMENT_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
          <div>
            <Input
              label="Name *"
              list={listId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              hint={name.trim() ? (nextVersion > 1 ? `Will be saved as version ${nextVersion} of “${name.trim()}”.` : "A new document.") : undefined}
            />
            <datalist id={listId}>{existingNames.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
        </div>
      )}
      <Input label="Notes" placeholder="e.g. Tailored for frontend roles" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      {uploading && (
        <div role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
        <Button type="submit" loading={uploading}>{uploading ? `Uploading ${progress}%` : "Upload"}</Button>
      </div>
    </form>
  );
}
