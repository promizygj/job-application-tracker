import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Choose a new password</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
