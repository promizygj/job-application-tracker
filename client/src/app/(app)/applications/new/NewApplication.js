"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ApplicationsView } from "@/components/applications/ApplicationsView";
import { ApplicationForm, toFormValues } from "@/components/applications/ApplicationForm";
import { STATUS } from "@/lib/constants";
import { getApiError, useCreateApplicationMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

export function NewApplication() {
  const router = useRouter();
  const toast = useToast();
  const [createApplication] = useCreateApplicationMutation();
  // "+ Add" on a board column opens /applications/new?status=APPLIED
  const status = useSearchParams().get("status");
  const initialValues = toFormValues(STATUS[status] ? { status } : null);

  async function submit(payload) {
    try {
      const app = await createApplication(payload).unwrap();
      toast(`Added ${app.company}`);
      router.push(`/applications/${app.id}`);
    } catch (err) {
      throw getApiError(err);
    }
  }

  return (
    <>
      {/* Figma: the form is a dialog over the Applications list. The list behind is inert. */}
      <div inert aria-hidden>
        <ApplicationsView />
      </div>
      {/* Next keeps visited pages alive (Activity). A new bfcacheId on each forward navigation gives a
          fresh form, while browser Back still restores an unfinished draft. */}
      <ApplicationForm
        key={router.bfcacheId}
        asDialog
        initialValues={initialValues}
        title="New application"
        subtitle="Track a job you've applied to — or one you want to apply for."
        submitLabel="Save application"
        onSubmit={submit}
      />
    </>
  );
}
