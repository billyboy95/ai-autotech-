"use client";

import { signInWithProvider } from "@/app/actions/auth";
import { authProviderLabel, type AuthProviderId } from "@/lib/auth/providers";

const buttonClass: Record<AuthProviderId, string> = {
  google: "border border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa]",
  facebook: "bg-[#1877F2] text-white hover:bg-[#166fe5]",
  github: "bg-[#24292f] text-white hover:bg-[#1b1f23]",
  apple: "bg-black text-white hover:bg-[#1d1d1f]",
  azure: "border border-[#8c8c8c] bg-white text-[#1f1f1f] hover:bg-[#f5f5f5]",
  linkedin_oidc: "bg-[#0A66C2] text-white hover:bg-[#004182]",
  x: "bg-black text-white hover:bg-[#1d1d1f]",
  discord: "bg-[#5865F2] text-white hover:bg-[#4752c4]",
};

function ProviderIcon({ id }: { id: AuthProviderId }) {
  const common = "h-5 w-5 shrink-0";
  if (id === "google") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.09z" />
        <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.14 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} fill-current`} aria-hidden="true">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
      </svg>
    );
  }
  if (id === "github") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} fill-current`} aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.28-1.67-1.28-1.67-.87-.6.07-.58.07-.58.96.07 1.46.98 1.46.98.85 1.46 2.24 1.04 2.78.8.09-.62.33-1.04.6-1.28-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
      </svg>
    );
  }
  if (id === "apple") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} fill-current`} aria-hidden="true">
        <path d="M16.37 12.73c.03 2.46 2.16 3.28 2.19 3.29-.02.06-.34 1.16-1.12 2.3-.67.99-1.37 1.97-2.48 1.99-1.08.02-1.43-.64-2.67-.64s-1.63.62-2.65.66c-1.06.04-1.87-1.06-2.56-2.04-1.39-2.01-2.45-5.69-1.03-8.17.71-1.23 1.97-2 3.34-2.03 1.04-.02 2.03.7 2.67.7.64 0 1.84-.87 3.1-.74.53.02 2.02.21 2.97 1.6-.08.05-1.77 1.03-1.76 3.08zM14.7 6.4c.56-.68.94-1.62.84-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.86 2.47.91.07 1.83-.46 2.39-1.13z" />
      </svg>
    );
  }
  if (id === "azure") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
        <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
        <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
        <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
      </svg>
    );
  }
  if (id === "linkedin_oidc") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} fill-current`} aria-hidden="true">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.28 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
      </svg>
    );
  }
  if (id === "x") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} fill-current`} aria-hidden="true">
        <path d="M18.24 2H21.5l-7.5 8.57L23 22h-6.59l-5.16-6.74L6.4 22H3.12l8.02-9.17L1.5 2h6.76l4.66 6.17L18.24 2zm-1.16 18h1.8L7.01 3.9H5.08L17.08 20z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`${common} fill-current`} aria-hidden="true">
      <path d="M19.27 5.33A17.4 17.4 0 0 0 15 4a.1.1 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.36-.76-.54-1.09A.09.09 0 0 0 9 4a17.4 17.4 0 0 0-4.27 1.33.1.1 0 0 0-.04.02C2 9.42 1.22 13.38 1.6 17.3a.1.1 0 0 0 .03.05 17.6 17.6 0 0 0 5.24 2.65.1.1 0 0 0 .08-.02c.4-.55.76-1.13 1.07-1.74a.08.08 0 0 0-.04-.09 11.6 11.6 0 0 1-1.64-.78.08.08 0 0 1-.01-.11l.33-.25a.07.07 0 0 1 .07-.01c3.44 1.57 7.15 1.57 10.55 0a.07.07 0 0 1 .07.01c.11.08.22.17.33.25a.08.08 0 0 1-.01.11 10.8 10.8 0 0 1-1.64.78.08.08 0 0 0-.04.09c.32.61.68 1.19 1.07 1.74a.1.1 0 0 0 .08.02 17.5 17.5 0 0 0 5.25-2.65.1.1 0 0 0 .03-.05c.44-4.53-.73-8.46-3.1-11.95a.08.08 0 0 0-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12 1.9.96 1.89 2.12-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12 1.9.96 1.89 2.12-.83 2.12-1.89 2.12z" />
    </svg>
  );
}

export function SocialSignIn({ providers, next }: { providers: AuthProviderId[]; next?: string }) {
  if (!providers.length) return null;
  return (
    <div className="grid gap-2">
      {providers.map((id) => (
        <form key={id} action={signInWithProvider}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <input type="hidden" name="provider" value={id} />
          <button
            type="submit"
            data-provider={id}
            className={`inline-flex h-11 w-full items-center justify-center gap-3 rounded-md px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${buttonClass[id]}`}
          >
            <ProviderIcon id={id} />
            Continue with {authProviderLabel(id)}
          </button>
        </form>
      ))}
    </div>
  );
}
