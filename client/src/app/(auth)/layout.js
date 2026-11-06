import Link from "next/link";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-white">
      <BrandPanel />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-12">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
