import { Suspense } from "react";
import { DocumentsView } from "@/components/documents/DocumentsView";
import { Spinner } from "@/components/ui/States";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <DocumentsView />
    </Suspense>
  );
}
