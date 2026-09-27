import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/login-form";
import { googleSignInAvailable } from "@/lib/auth/google";
import { loginCopy } from "@/lib/brand/present";
import { safeNextPath } from "@/lib/auth/redirect";
import { resolveRequestBrand } from "@/lib/brand/request";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveRequestBrand();
  const copy = loginCopy(brand);
  if (!copy.showPlatform) {
    return {
      title: { absolute: copy.title },
      description: copy.body,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: "Sign in",
    description: "Sign in to AI AutoTech.",
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeNextPath(params.next, "") : "";
  const brand = await resolveRequestBrand();
  const copy = loginCopy(brand);
  const destination = next || (copy.showPlatform ? undefined : "/command-centre");
  const google = await googleSignInAvailable();
  const body =
    google && copy.showPlatform
      ? "Agency owners and client teams sign in with Supabase Auth. Use your email and password, Continue with Google, or email yourself a magic link. AI AutoTech staff land on the agency view. EASTC and other client users land in their own workspace."
      : undefined;

  return (
    <AuthCard body={body}>
      {params.error ? <p className="mb-4 text-sm font-medium text-rose-700">{params.error}</p> : null}
      <LoginForm next={destination} placeholder={copy.placeholder} google={google} />
    </AuthCard>
  );
}
