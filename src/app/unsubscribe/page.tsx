import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; channel?: string; address?: string }>;
}) {
  const query = await searchParams;
  const org = query.org || "";
  const channel = query.channel === "sms" || query.channel === "whatsapp" ? query.channel : "email";
  const address = query.address || "";

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <form method="post" action="/api/public/unsubscribe" className="grid w-full max-w-md gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Unsubscribe</h1>
        <p className="text-sm text-slate-600">This opts the address out of marketing for that workspace. It does not send a message.</p>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Workspace slug
          <input name="org" defaultValue={org} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Channel
          <select name="channel" defaultValue={channel} className="h-10 rounded-md border border-slate-200 px-2 text-sm">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Address
          <input name="address" defaultValue={address} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <button className="h-10 rounded-md bg-[#0B1F3A] text-sm font-semibold text-white">Confirm opt-out</button>
      </form>
    </main>
  );
}
