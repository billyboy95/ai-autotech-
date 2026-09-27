import { importSetupContacts, placeholderChannel } from "@/app/actions/setup";
import { accountsForTemplate } from "@/lib/bots/interview";
import { templateBySlug } from "@/lib/bots/catalog";

const buttonClass = "inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

export function SetupReady({
  orgSlug,
  teamSlug,
  notice,
}: {
  orgSlug: string;
  teamSlug: string;
  notice?: string;
}) {
  let templateName = "Your team";
  let accounts: ReturnType<typeof accountsForTemplate> = [];
  try {
    templateName = templateBySlug(teamSlug).name;
    accounts = accountsForTemplate(teamSlug);
  } catch {
    accounts = [];
  }
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Your team is ready</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">{templateName} is configured. Two steps are left. Nothing is sent.</p>
      </div>
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
      {accounts.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">That team is not in the catalogue. Go back to setup and choose a business.</p>
      ) : (
        <>
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Connect your accounts</h2>
            <p className="text-sm text-slate-700">Only the accounts this team uses are listed. Each button is a placeholder. No key is stored.</p>
            <ul className="grid gap-2">
              {accounts.map((account) => (
                <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-sm font-semibold text-[#0B1F3A]">{account.label}</p>
                  {account.channel && account.provider ? (
                    <form action={placeholderChannel}>
                      <input type="hidden" name="slug" value={orgSlug} />
                      <input type="hidden" name="team" value={teamSlug} />
                      <input type="hidden" name="channel" value={account.channel} />
                      <input type="hidden" name="provider" value={account.provider} />
                      <input type="hidden" name="label" value={account.label} />
                      <button className={buttonClass}>Connect {account.label}</button>
                    </form>
                  ) : (
                    <p className="text-sm text-slate-700">Placeholder. No key is stored.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Import your contacts</h2>
            <p className="text-sm text-slate-700">Upload a CSV with name and consent_basis. consent means they opted in. existing_customer means you already work with them. Nothing is sent.</p>
            <form action={importSetupContacts} className="grid gap-3">
              <input type="hidden" name="slug" value={orgSlug} />
              <input type="hidden" name="team" value={teamSlug} />
              <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="setup-contacts">
                Contacts CSV
                <input id="setup-contacts" name="file" type="file" accept=".csv,text/csv" className="text-sm font-normal" />
              </label>
              <button className={`${buttonClass} w-fit`}>Import contacts</button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
