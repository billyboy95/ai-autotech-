import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sandbox computer",
  robots: { index: false, follow: false },
};

export default async function AgentComputerViewPage({
  searchParams,
}: {
  searchParams: Promise<{ viewOnly?: string; provider?: string }>;
}) {
  const query = await searchParams;
  const viewOnly = query.viewOnly !== "0";
  const provider = query.provider === "e2b" ? "E2B stub" : "Fixture";
  return (
    <main className="grid min-h-80 gap-3 bg-slate-50 p-6 text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{provider}</p>
      <h1 className="font-display text-xl font-bold text-[#0B1F3A]">Sandbox computer</h1>
      <p className="max-w-xl text-sm text-slate-700">
        Computers are sandbox until Billy enables a provider. This placeholder is not a live desktop. No request was sent and nothing was charged.
      </p>
      <p className="text-sm font-semibold text-[#0B1F3A]">{viewOnly ? "View only" : "Take over"}</p>
    </main>
  );
}
