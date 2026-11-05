"use client";

import { setupListeners } from "@reduxjs/toolkit/query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { Spinner } from "@/components/ui/States";
import { makeStore } from "@/store";

const subscribe = () => () => {};

/** false on the server and during hydration, true afterwards. */
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function StoreProvider({ children }) {
  const [store] = useState(makeStore);
  const hydrated = useHydrated();
  // Refetch data when the tab regains focus or the network comes back.
  useEffect(() => setupListeners(store.dispatch), [store]);

  // Signed-in pages get all their data in the browser. Rendering them only after hydration means the
  // server HTML (a spinner) can never disagree with what the browser renders, whatever has loaded by then.
  return <Provider store={store}>{hydrated ? children : <Spinner />}</Provider>;
}
