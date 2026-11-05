import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/components/StoreProvider";
import { Spinner } from "@/components/ui/States";

// Signed-in pages fetch their data in the browser, so the Redux store is created per request
// (behind Suspense) rather than during prerendering.
export default function AppLayout({ children }) {
  return (
    <Suspense fallback={<Spinner />}>
      <StoreProvider>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </Suspense>
  );
}
