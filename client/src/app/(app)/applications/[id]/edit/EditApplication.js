"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApplicationForm, toFormValues } from "@/components/applications/ApplicationForm";
import { ErrorState, Spinner } from "@/components/ui/States";
import { getApiError, useGetApplicationQuery, useUpdateApplicationMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

export function EditApplication() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const { data: app, isLoading, isError, refetch } = useGetApplicationQuery(id);
  const [updateApplication] = useUpdateApplicationMutation();

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Couldn't load this application." onRetry={refetch} />;

  async function submit(payload) {
    try {
      await updateApplication({ id, ...payload }).unwrap();
      toast("Changes saved");
      router.push(`/applications/${id}`);
    } catch (err) {
      throw getApiError(err);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/applications/${id}`} className="text-sm text-slate-600 hover:underline">← {app.company}</Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit application</h1>
      </div>
      {/* key: reset the form if the application reloads with new data */}
      <ApplicationForm key={app.updatedAt} initialValues={toFormValues(app)} submitLabel="Save changes" onSubmit={submit} />
    </div>
  );
}
