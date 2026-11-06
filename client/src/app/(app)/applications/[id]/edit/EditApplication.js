"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
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
    <div className="mx-auto max-w-[680px] space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs leading-4">
        <Link href={`/applications/${id}`} className="text-ink-3 hover:text-ink">{app.company} — {app.jobTitle}</Link>
        <Icon name="chevronRight" size={14} className="text-ink-3" />
        <span className="font-medium text-ink">Edit</span>
      </nav>
      {/* key: reset the form if the application reloads with new data */}
      <ApplicationForm key={app.updatedAt} initialValues={toFormValues(app)} title="Edit application"
        subtitle={`${app.company} · ${app.jobTitle}`}
        submitLabel="Save changes" onSubmit={submit} />
    </div>
  );
}
