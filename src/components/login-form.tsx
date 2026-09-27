"use client";

import { useActionState } from "react";
import Link from "next/link";
import { sendMagicLink, sendPasswordReset, signIn, updatePassword, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {
  ok: false,
  message: "",
};

const fieldClass =
  "h-11 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100";

function Notice({ state }: { state: AuthActionState }) {
  if (!state.message) return null;
  return (
    <p className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
  );
}

export function LoginForm({ next, placeholder = "admin@ai-autotech.co.za" }: { next?: string; placeholder?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [magic, magicAction, magicPending] = useActionState(sendMagicLink, initialState);
  const forgotHref = next ? `/login/forgot?next=${encodeURIComponent(next)}` : "/login/forgot";

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" required autoComplete="email" className={fieldClass} placeholder={placeholder} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Password
          <input name="password" type="password" required autoComplete="current-password" className={fieldClass} placeholder="Supabase Auth password" />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        <Notice state={state} />
        <Link href={forgotHref} className="text-sm font-semibold text-[#2563EB]">
          Forgot password
        </Link>
      </form>

      <form action={magicAction} className="grid gap-4 border-t border-slate-200 pt-6">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <p className="text-sm font-medium text-slate-700">Or email yourself a magic link</p>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" required autoComplete="email" className={fieldClass} placeholder={placeholder} />
        </label>
        <button
          type="submit"
          disabled={magicPending}
          className="h-11 rounded-md border border-[#2563EB] px-4 text-sm font-semibold text-[#2563EB] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {magicPending ? "Sending..." : "Email me a sign-in link"}
        </button>
        <Notice state={magic} />
      </form>
    </div>
  );
}

export function ForgotPasswordForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(sendPasswordReset, initialState);
  return (
    <form action={formAction} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input name="email" type="email" required autoComplete="email" className={fieldClass} placeholder="you@aiautotech.co.za" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send reset link"}
      </button>
      <Notice state={state} />
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);
  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Confirm password
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save password"}
      </button>
      <Notice state={state} />
    </form>
  );
}
