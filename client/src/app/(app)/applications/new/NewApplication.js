"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/applications" className="text-sm text-slate-600 hover:underline">← Applications</Link>
        <h1 className="mt-2 text-2xl font-semibold">New application</h1>
      </div>
      {/* Next keeps visited pages alive (Activity). A new bfcacheId on each forward navigation gives a
          fresh form, while browser Back still restores an unfinished draft. */}
      <ApplicationForm key={router.bfcacheId} initialValues={initialValues} submitLabel="Save application" onSubmit={submit} />
    </div>
  );
}
