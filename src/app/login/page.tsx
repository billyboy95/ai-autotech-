import Link from "next/link";
import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the AI AutoTech Command Centre.",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0B1F3A] text-[#38BDF8]">
            <Bot size={22} />
          </span>
          <span>
            <span className="block font-display text-base font-bold text-[#0B1F3A]">AI AutoTech</span>
            <span className="block text-xs font-medium text-slate-500">Command Centre</span>
          </span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Sign in</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">
          Connect Supabase Auth users and roles to protect the private dashboard.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
