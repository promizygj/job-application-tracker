import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-8 text-2xl" />
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your job search, organised.</h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Track every application, interview and CV version from one dashboard, and see what&apos;s working.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500">
          Get started
        </Link>
        <Link href="/login" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-medium hover:bg-slate-100">
          Log in
        </Link>
      </div>
    </main>
  );
}
