import type { Metadata } from "next";
import { TryChat } from "@/components/try-chat/chat";
import { TRY_BANNER } from "@/lib/try-chat/prompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Test chat",
  description: TRY_BANNER,
  robots: { index: false, follow: false },
};

export default async function TryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.t === "string" ? query.t : "";
  return <TryChat slug={slug} token={token} />;
}
