import { ProfileSettings } from "@/components/settings/ProfileSettings";

// Signed-in pages render in the browser only (see components/StoreProvider.js), so there is nothing
// for Next's instant-navigation check to validate on the server.
export const instant = false;

export const metadata = { title: "Profile settings" };

export default function ProfileSettingsPage() {
  return <ProfileSettings />;
}
