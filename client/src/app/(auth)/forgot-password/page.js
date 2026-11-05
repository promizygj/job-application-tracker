import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Forgot your password?</h1>
      <p className="mb-6 text-sm text-slate-600">We&apos;ll email you a link to reset it.</p>
      <ForgotPasswordForm />
    </>
  );
}
