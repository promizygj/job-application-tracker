import { createApi } from "@reduxjs/toolkit/query/react";
import { api, firstPerField } from "@/lib/api";

/** RTK Query base query that goes through our axios instance (and its 401 → sign-out interceptor). */
const axiosBaseQuery =
  () =>
  async ({ url, method = "GET", data, params }) => {
    try {
      const res = await api.request({ url, method, data, params });
      return { data: res.data };
    } catch (err) {
      return { error: { status: err.response?.status ?? "FETCH_ERROR", data: err.response?.data } };
    }
  };

// The API wraps payloads as { data, meta? }.
const unwrap = (res) => res.data;
const LIST = { type: "Application", id: "LIST" };
const INTERVIEWS = { type: "Interview", id: "LIST" };
export const DOCUMENTS = { type: "Document", id: "LIST" };
// Interviews show up on the application page, the board (next interview) and the dashboard.
const interviewChanged = (applicationId) => [INTERVIEWS, { type: "Application", id: applicationId }, "Board", "Dashboard"];

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Me", "Application", "Dashboard", "Board", "Interview", "Document"],
  endpoints: (build) => ({
    // ── Profile ──
    getMe: build.query({ query: () => ({ url: "/users/me" }), transformResponse: (r) => r.data.user, providesTags: ["Me"] }),
    resendVerification: build.mutation({ query: () => ({ url: "/auth/resend-verification", method: "POST" }) }),
    updateMe: build.mutation({
      query: (body) => ({ url: "/users/me", method: "PATCH", data: body }),
      transformResponse: (r) => r.data.user,
      // Write the new profile straight into the cache; the dashboard's weekly buckets depend on the time zone.
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(apiSlice.util.upsertQueryData("getMe", undefined, data));
        } catch {}
      },
      invalidatesTags: ["Dashboard"],
    }),
    changePassword: build.mutation({ query: (body) => ({ url: "/users/me/password", method: "PATCH", data: body }) }),
    requestEmailChange: build.mutation({ query: (body) => ({ url: "/users/me/email", method: "POST", data: body }) }),
    logoutAll: build.mutation({ query: () => ({ url: "/auth/logout-all", method: "POST" }) }),
    deleteAccount: build.mutation({ query: (body) => ({ url: "/users/me", method: "DELETE", data: body }) }),

    // ── Applications ──
    listApplications: build.query({
      query: (params) => ({ url: "/applications", params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: (result) => [LIST, ...(result?.items ?? []).map(({ id }) => ({ type: "Application", id }))],
    }),
    getApplication: build.query({
      query: (id) => ({ url: `/applications/${id}` }),
      transformResponse: (r) => r.data.application,
      providesTags: (result, error, id) => [{ type: "Application", id }],
    }),
    createApplication: build.mutation({
      query: (body) => ({ url: "/applications", method: "POST", data: body }),
      transformResponse: (r) => r.data.application,
      invalidatesTags: [LIST, "Dashboard", "Board"],
    }),
    updateApplication: build.mutation({
      query: ({ id, ...body }) => ({ url: `/applications/${id}`, method: "PATCH", data: body }),
      transformResponse: (r) => r.data.application,
      invalidatesTags: (result, error, { id }) => [{ type: "Application", id }, LIST, "Dashboard", "Board"],
    }),
    deleteApplication: build.mutation({
      query: (id) => ({ url: `/applications/${id}`, method: "DELETE" }),
      invalidatesTags: (result, error, id) => [{ type: "Application", id }, LIST, "Dashboard", "Board"],
    }),

    // ── Kanban board ──
    getBoard: build.query({
      query: (params) => ({ url: "/board", params }),
      transformResponse: (r) => r.data.columns,
      providesTags: ["Board"],
    }),
    /**
     * Moves a card. Updates the board cache immediately (optimistic) and rolls back if the API fails.
     * `boardArgs` = the getBoard() args currently on screen, so we patch the right cache entry.
     */
    moveApplication: build.mutation({
      query: ({ id, status, beforeId }) => ({ url: `/applications/${id}/move`, method: "PATCH", data: { status, beforeId } }),
      transformResponse: (r) => r.data.application,
      async onQueryStarted({ id, status, beforeId, boardArgs }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          apiSlice.util.updateQueryData("getBoard", boardArgs, (columns) => {
            let card;
            for (const cards of Object.values(columns)) {
              const i = cards.findIndex((c) => c.id === id);
              if (i !== -1) [card] = cards.splice(i, 1);
            }
            if (!card) return;
            card.status = status;
            const target = columns[status];
            const at = beforeId ? target.findIndex((c) => c.id === beforeId) : -1;
            target.splice(at === -1 ? target.length : at, 0, card);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          // Copy server-computed fields (position, appliedAt…) without reordering.
          dispatch(
            apiSlice.util.updateQueryData("getBoard", boardArgs, (columns) => {
              const card = columns[data.status]?.find((c) => c.id === id);
              if (card) Object.assign(card, data);
            }),
          );
        } catch {
          patch.undo();
        }
      },
      // The board itself is already up to date; refresh everything else that shows this application.
      invalidatesTags: (result, error, { id }) => [{ type: "Application", id }, LIST, "Dashboard"],
    }),

    // ── Interviews ──
    listInterviews: build.query({
      query: (params) => ({ url: "/interviews", params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: (result) => [INTERVIEWS, ...(result?.items ?? []).map(({ id }) => ({ type: "Interview", id }))],
    }),
    /** Returns { interview, suggestedStatus } — suggestedStatus "INTERVIEW" means: offer to move the application. */
    createInterview: build.mutation({
      query: ({ applicationId, ...body }) => ({ url: `/applications/${applicationId}/interviews`, method: "POST", data: body }),
      transformResponse: unwrap,
      invalidatesTags: (result, error, { applicationId }) => interviewChanged(applicationId),
    }),
    updateInterview: build.mutation({
      query: ({ id, applicationId: _ignored, ...body }) => ({ url: `/interviews/${id}`, method: "PATCH", data: body }),
      transformResponse: (r) => r.data.interview,
      invalidatesTags: (result, error, { id, applicationId }) => [{ type: "Interview", id }, ...interviewChanged(applicationId)],
    }),
    deleteInterview: build.mutation({
      query: ({ id }) => ({ url: `/interviews/${id}`, method: "DELETE" }),
      invalidatesTags: (result, error, { id, applicationId }) => [{ type: "Interview", id }, ...interviewChanged(applicationId)],
    }),

    // ── Documents ── (uploads go through lib/documents.js for progress reporting)
    listDocuments: build.query({
      query: (params) => ({ url: "/documents", params }),
      transformResponse: unwrap,
      providesTags: (result) => [DOCUMENTS, ...(result ?? []).map(({ id }) => ({ type: "Document", id }))],
    }),
    updateDocument: build.mutation({
      query: ({ id, ...body }) => ({ url: `/documents/${id}`, method: "PATCH", data: body }),
      transformResponse: (r) => r.data.document,
      // Renaming or changing the default can affect other versions too, so refresh the whole list.
      invalidatesTags: [DOCUMENTS, "Application"],
    }),
    deleteDocument: build.mutation({
      query: ({ id, force }) => ({ url: `/documents/${id}`, method: "DELETE", params: force ? { force: true } : undefined }),
      invalidatesTags: [DOCUMENTS, "Application"],
    }),
    attachDocument: build.mutation({
      query: ({ applicationId, documentId }) => ({ url: `/applications/${applicationId}/documents`, method: "POST", data: { documentId } }),
      invalidatesTags: (result, error, { applicationId }) => [{ type: "Application", id: applicationId }, DOCUMENTS],
    }),
    detachDocument: build.mutation({
      query: ({ applicationId, documentId }) => ({ url: `/applications/${applicationId}/documents/${documentId}`, method: "DELETE" }),
      invalidatesTags: (result, error, { applicationId }) => [{ type: "Application", id: applicationId }, DOCUMENTS],
    }),

    // ── Dashboard ──
    getDashboardSummary: build.query({ query: () => ({ url: "/dashboard/summary" }), transformResponse: unwrap, providesTags: ["Dashboard"] }),
    getDashboardActivity: build.query({
      query: (weeks = 12) => ({ url: "/dashboard/activity", params: { weeks } }),
      transformResponse: unwrap,
      providesTags: ["Dashboard"],
    }),
  }),
});

export const {
  useGetMeQuery,
  useResendVerificationMutation,
  useUpdateMeMutation,
  useChangePasswordMutation,
  useRequestEmailChangeMutation,
  useLogoutAllMutation,
  useDeleteAccountMutation,
  useListApplicationsQuery,
  useGetApplicationQuery,
  useCreateApplicationMutation,
  useUpdateApplicationMutation,
  useDeleteApplicationMutation,
  useGetDashboardSummaryQuery,
  useGetDashboardActivityQuery,
  useGetBoardQuery,
  useMoveApplicationMutation,
  useListInterviewsQuery,
  useCreateInterviewMutation,
  useUpdateInterviewMutation,
  useDeleteInterviewMutation,
  useListDocumentsQuery,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useAttachDocumentMutation,
  useDetachDocumentMutation,
} = apiSlice;

/** { message, fieldErrors } from an RTK Query error. */
export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const body = error?.data?.error;
  const fieldErrors = firstPerField(body?.details);
  return { message: body?.message ?? fallback, fieldErrors };
}
