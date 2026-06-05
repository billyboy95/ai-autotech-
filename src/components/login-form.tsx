"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {
  ok: false,
  message: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input
          name="email"
          type="email"
          required
          className="h-11 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
          placeholder="admin@ai-autotech.co.za"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Password
        <input
          name="password"
          type="password"
          required
          className="h-11 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
          placeholder="Supabase Auth password"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
      {state.message ? <p className="text-sm font-medium text-rose-700">{state.message}</p> : null}
    </form>
  );
}
