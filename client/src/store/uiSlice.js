import { createSlice, nanoid } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { toasts: [] },
  reducers: {
    addToast: {
      reducer: (state, { payload }) => {
        state.toasts.push(payload);
      },
      prepare: ({ type = "success", message }) => ({ payload: { id: nanoid(), type, message } }),
    },
    removeToast: (state, { payload: id }) => {
      state.toasts = state.toasts.filter((t) => t.id !== id);
    },
  },
});

export const { addToast, removeToast } = uiSlice.actions;
export default uiSlice.reducer;
