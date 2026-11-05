import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
      <p className="mb-6 text-sm text-slate-600">Start tracking your applications in minutes.</p>
      <RegisterForm />
    </>
  );
}
