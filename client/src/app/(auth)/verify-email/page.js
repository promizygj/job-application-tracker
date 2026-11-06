import { Suspense } from "react";
import { VerifyEmail } from "./VerifyEmail";

export const metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
