import { Suspense } from "react";
import { ApplicationsView } from "@/components/applications/ApplicationsView";
import { Spinner } from "@/components/ui/States";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Applications" };

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ApplicationsView />
    </Suspense>
  );
}
