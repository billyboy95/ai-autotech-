export type SandboxLeadPlan = {
  sandbox: true;
  label: "TEST";
  name: string;
  phone: string;
  email: string;
  company: string;
  stage: "New";
  source: "bot-try";
  notes: string;
  marketingConsent: false;
  enrolled: false;
  valueZar: 0;
};

export function planLeadCapture(input: {
  name: string;
  phone: string;
  email: string;
  company: string;
  note: string;
}): { ok: true; plan: SandboxLeadPlan } | { ok: false; message: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Who should I save? Send a name. Nothing was stored." };
  const note = input.note.trim();
  return {
    ok: true,
    plan: {
      sandbox: true,
      label: "TEST",
      name: name.slice(0, 120),
      phone: input.phone.trim().slice(0, 40),
      email: input.email.trim().toLowerCase().slice(0, 160),
      company: input.company.trim().slice(0, 160),
      stage: "New",
      source: "bot-try",
      notes: `TEST sandbox capture from the try chat. Nothing was sent and nothing was charged.${note ? ` ${note}` : ""}`.slice(0, 1000),
      marketingConsent: false,
      enrolled: false,
      valueZar: 0,
    },
  };
}

export function leadReply(plan: SandboxLeadPlan) {
  return `Saved ${plan.name} as a TEST lead. Nothing was sent and nothing was charged.`;
}
