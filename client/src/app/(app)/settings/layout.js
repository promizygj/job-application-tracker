import { SettingsNav } from "@/components/settings/SettingsNav";
import { PageHeader } from "@/components/ui/States";

export default function SettingsLayout({ children }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your profile, sign-in details and your data." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0 max-w-[880px]">{children}</div>
      </div>
    </div>
  );
}
