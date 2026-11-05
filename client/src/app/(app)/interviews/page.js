import { Suspense } from "react";
import { InterviewsView } from "@/components/interviews/InterviewsView";
import { Spinner } from "@/components/ui/States";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Interviews" };

export default function InterviewsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <InterviewsView />
    </Suspense>
  );
}
