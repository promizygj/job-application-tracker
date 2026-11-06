import { AuthHeading } from "@/components/auth/AuthHeading";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Forgot your password?">We&apos;ll email you a link to reset it.</AuthHeading>
      <ForgotPasswordForm />
    </>
  );
}
