import { Suspense } from "react";
import { VerifyEmail } from "./VerifyEmail";

export const metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Email verification</h1>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </>
  );
}
