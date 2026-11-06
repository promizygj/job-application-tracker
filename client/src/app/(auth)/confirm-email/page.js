import { AuthHeading } from "@/components/auth/AuthHeading";
import { Suspense } from "react";
import { ConfirmEmail } from "./ConfirmEmail";

export const metadata = { title: "Confirm new email" };

export default function ConfirmEmailPage() {
  return (
    <>
      <AuthHeading title="Confirm your new email" />
      <Suspense>
        <ConfirmEmail />
      </Suspense>
    </>
  );
}
