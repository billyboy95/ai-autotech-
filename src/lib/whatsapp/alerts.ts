/** Handover alerts to Billy by email from the AgentMail inbox. Needs AGENTMAIL_API_KEY. */

const INBOX = () => process.env.AGENTMAIL_INBOX || "aiautotech-alerts@agentmail.to";
const TO = () => process.env.WHATSAPP_ALERT_EMAIL || "billyfaber06@gmail.com";

export type AlertInput = {
  waId: string;
  profileName?: string;
  reason: string;
  intent: string;
  lead: Record<string, string | undefined>;
  transcript: Array<{ who: string; text: string }>;
  isTest: boolean;
};

export async function sendHandoverAlert(a: AlertInput): Promise<{ sent: boolean; detail: string }> {
  if (a.isTest && process.env.WHATSAPP_ALERT_TESTS !== "1") return { sent: false, detail: "test conversation, alert suppressed" };
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) return { sent: false, detail: "AGENTMAIL_API_KEY not set" };

  const hot = a.intent === "handover_hot";
  const name = a.lead.name || a.profileName || "Unknown";
  const phone = a.waId.startsWith("sim:") ? a.waId : `+${a.waId}`;
  const subject = `${a.isTest ? "[TEST] " : ""}${hot ? "HOT lead" : "WhatsApp handover"}: ${name}${a.lead.business ? ` (${a.lead.business})` : ""}`;
  const facts = Object.entries(a.lead)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const convo = a.transcript
    .slice(-14)
    .map((m) => `${m.who}: ${m.text}`)
    .join("\n");
  const wa = a.waId.startsWith("sim:") ? "" : `\nOpen chat: https://wa.me/${a.waId}`;
  const text = `Reason: ${a.reason}\nPhone: ${phone}${wa}\n\n${facts || "No details captured yet."}\n\nThe bot has paused on this chat. Reply from the WhatsApp Business app and it stays paused.\n\nLast messages:\n${convo}\n\nCRM: https://ai-autotech-crm.vercel.app/whatsapp`;

  try {
    const res = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(INBOX())}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: [TO()], subject, text, labels: ["whatsapp-handover"] }),
    });
    if (!res.ok) return { sent: false, detail: `AgentMail ${res.status} ${(await res.text()).slice(0, 200)}` };
    return { sent: true, detail: "sent" };
  } catch (e) {
    return { sent: false, detail: (e as Error).message };
  }
}
