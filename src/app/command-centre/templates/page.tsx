import type { Metadata } from "next";
import { saveTemplate } from "@/app/actions/automation";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Templates | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function TemplatesPage() {
  const { workspace, sendingEnabled } = await loadCommandData();

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Message templates</h1>
        <p className="text-sm text-slate-500">
          Placeholders: {"{{firstName}}"}, {"{{company}}"}, {"{{bookingUrl}}"}, {"{{owner}}"}, {"{{when}}"}.
        </p>
      </div>
      <div className="grid gap-4">
        {workspace.state.templates.map((template) => (
          <form key={template.key} action={saveTemplate} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-[#0B1F3A]">{template.name}</h2>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{template.channel}</span>
            </div>
            <input type="hidden" name="key" value={template.key} />
            {template.channel === "email" ? (
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Subject
                <input name="subject" defaultValue={template.subject} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium" />
              </label>
            ) : (
              <input type="hidden" name="subject" value={template.subject} />
            )}
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Message
              <textarea name="body" rows={6} defaultValue={template.body} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked={template.active} />
              Active
            </label>
            <button className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Save template</button>
          </form>
        ))}
      </div>
    </CommandShell>
  );
}
