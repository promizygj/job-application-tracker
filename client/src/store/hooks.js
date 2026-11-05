"use client";

import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { addToast } from "./uiSlice";

/** toast("Saved") or toast("Failed", "error") */
export function useToast() {
  const dispatch = useDispatch();
  return useCallback((message, type = "success") => dispatch(addToast({ message, type })), [dispatch]);
}
