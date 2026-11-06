import { AuthHeading } from "@/components/auth/AuthHeading";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading title="Create your account">Track every job you apply for — from applied to offer.</AuthHeading>
      <RegisterForm />
    </>
  );
}
