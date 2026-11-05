import { Suspense } from "react";
import { ApplicationDetail } from "@/components/applications/ApplicationDetail";
import { Spinner } from "@/components/ui/States";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Application" };

export default function ApplicationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ApplicationDetail />
    </Suspense>
  );
}
