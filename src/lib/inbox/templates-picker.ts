/**
 * Named templates picker for the inbox composer.
 * Unset, blank, or any value other than the string true keeps today's composer:
 * no Templates button and no template list.
 * The list is the workspace message_templates already loaded for the inbox.
 * WhatsApp rows must be approved. Other channels are the stored channel templates.
 * Picking a row only replaces the reply text. Placeholders such as {{name}} stay
 * in the text. The send-gate template id is left unchanged, so a closed 24-hour
 * WhatsApp window stays closed.
 * This module does not send, does not call Meta, does not insert crm_outbox,
 * does not change consent, and does not turn sending_enabled on.
 */

import type { InboxTemplateOption } from "@/lib/inbox/types";

export const INBOX_TEMPLATES_PICKER_FLAG = "INBOX_TEMPLATES_PICKER_ENABLED";

export function inboxTemplatesPickerEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_TEMPLATES_PICKER_FLAG] ?? "").trim().toLowerCase() === "true";
}

/** Approved WhatsApp templates and named templates on other channels. */
export function templatesForPicker(templates: readonly InboxTemplateOption[]): InboxTemplateOption[] {
  const rows: InboxTemplateOption[] = [];
  for (const item of templates) {
    const name = item.name.trim();
    const channel = item.channel.trim();
    if (!name || !item.body.trim() || !channel) continue;
    if (channel === "whatsapp" && !item.approved) continue;
    rows.push({
      id: item.id,
      name,
      channel,
      subject: item.subject,
      body: item.body,
      waCategory: item.waCategory.trim(),
      approved: channel === "whatsapp" ? true : item.approved,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.channel.localeCompare(b.channel) || a.id.localeCompare(b.id));
  return rows;
}

/** Template text for the reply box. {{placeholders}} are left as written. */
export function fillComposerFromTemplate(template: { body: string }) {
  return template.body;
}

export type ComposerDraft = {
  body: string;
  templateId: string;
};

/**
 * Replace the reply text with the template body.
 * templateId stays as it was so this pick does not open the WhatsApp send gate.
 * A row the picker would hide leaves the draft unchanged.
 */
export function pickTemplateIntoComposer(draft: ComposerDraft, template: InboxTemplateOption): ComposerDraft {
  const match = templatesForPicker([template])[0];
  if (!match) return { body: draft.body, templateId: draft.templateId };
  return {
    body: fillComposerFromTemplate(match),
    templateId: draft.templateId,
  };
}
