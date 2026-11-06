import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Welcome back">Log in to keep tracking your applications.</AuthHeading>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
