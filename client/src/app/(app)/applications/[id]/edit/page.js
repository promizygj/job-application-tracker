import { Suspense } from "react";
import { Spinner } from "@/components/ui/States";
import { EditApplication } from "./EditApplication";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Edit application" };

export default function EditApplicationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EditApplication />
    </Suspense>
  );
}
