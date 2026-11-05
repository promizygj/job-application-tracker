/**
 * Detects the real file type from its first bytes ("magic numbers") instead of trusting
 * the browser's filename or Content-Type. Returns null for anything we don't accept.
 */
const PDF = Buffer.from("%PDF-");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy .doc

export const ALLOWED = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

export function detectDocumentType(buffer) {
  const starts = (sig) => buffer.subarray(0, sig.length).equals(sig);
  if (starts(PDF)) return { ext: "pdf", mimeType: ALLOWED.pdf };
  // .docx is a ZIP; its entry names (stored uncompressed) include "word/".
  if (starts(ZIP) && buffer.includes("word/")) return { ext: "docx", mimeType: ALLOWED.docx };
  if (starts(OLE)) return { ext: "doc", mimeType: ALLOWED.doc };
  return null;
}
