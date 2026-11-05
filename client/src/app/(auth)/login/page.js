import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-slate-600">Log in to your job search dashboard.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
