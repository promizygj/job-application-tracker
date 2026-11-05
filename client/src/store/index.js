import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "./apiSlice";
import uiReducer from "./uiSlice";

/** A new store per browser session (see components/StoreProvider.js). */
export const makeStore = () =>
  configureStore({
    reducer: { [apiSlice.reducerPath]: apiSlice.reducer, ui: uiReducer },
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  });
