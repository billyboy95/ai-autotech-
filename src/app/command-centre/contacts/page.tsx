import type { Metadata } from "next";
import Link from "next/link";
import { eraseContactAction } from "@/app/actions/contacts";
import { CommandShell } from "@/components/crm/command-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacts | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function ContactsPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const contacts = await loadContacts();

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div className="grid gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Contacts</h1>
          <p className="text-sm text-slate-500">
            Download returns this workspace&apos;s JSON copy. Erase anonymises the person and adds them to the suppression list.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    No contacts yet. A signed-in workspace member can download or erase a person after the phase 2b migration.
                  </td>
                </tr>
              ) : null}
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-[#0B1F3A]">
                    {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Erased"}
                  </td>
                  <td>{contact.email || "—"}</td>
                  <td>{contact.phone || "—"}</td>
                  <td>{contact.company || "—"}</td>
                  <td className="py-2 text-right">
                    <Link href={`/api/contacts/${contact.id}/export`} className="mr-3 font-semibold text-[#2563EB]">
                      Download my data
                    </Link>
                    <form action={eraseContactAction} className="inline">
                      <input type="hidden" name="id" value={contact.id} />
                      <button className="font-semibold text-rose-700">Erase</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CommandShell>
  );
}

async function loadContacts() {
  try {
    const supabase = await createSupabaseServerClient();
    const listed = await supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, phone_e164, company")
      .order("created_at", { ascending: false })
      .limit(200);
    if (listed.error) return [];
    return (listed.data ?? []).map((row) => ({
      id: String(row.id),
      firstName: String(row.first_name || ""),
      lastName: String(row.last_name || ""),
      email: String(row.email || ""),
      phone: String(row.phone_e164 || ""),
      company: String(row.company || ""),
    }));
  } catch {
    return [];
  }
}
