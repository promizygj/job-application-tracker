import { AuthHeading } from "@/components/auth/AuthHeading";
import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Choose a new password" />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
