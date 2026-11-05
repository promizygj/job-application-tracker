import { Suspense } from "react";
import { Spinner } from "@/components/ui/States";
import { NewApplication } from "./NewApplication";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "New application" };

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewApplication />
    </Suspense>
  );
}
