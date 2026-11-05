import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsNav />
      {children}
    </div>
  );
}
