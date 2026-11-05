import { Suspense } from "react";
import { BoardView } from "@/components/board/BoardView";
import { Spinner } from "@/components/ui/States";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BoardView />
    </Suspense>
  );
}
