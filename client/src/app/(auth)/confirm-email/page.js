import { Suspense } from "react";
import { ConfirmEmail } from "./ConfirmEmail";

export const metadata = { title: "Confirm new email" };

export default function ConfirmEmailPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Confirm your new email</h1>
      <Suspense>
        <ConfirmEmail />
      </Suspense>
    </>
  );
}
