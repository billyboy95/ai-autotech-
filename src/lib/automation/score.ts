const SIZE_KEYS = ["companySize", "company_size", "teamSize", "team_size", "employees", "staff", "size", "headcount"];

export function readCompanySize(answers: Record<string, unknown> | undefined, explicit?: string) {
  if (explicit && explicit.trim()) return explicit.trim();
  if (!answers) return "";
  for (const key of SIZE_KEYS) {
    const value = answers[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function scoreLead(input: {
  source?: string;
  qrSource?: string;
  companySize?: string;
  answers?: Record<string, unknown>;
  recommendations?: unknown[];
  phone?: string;
  website?: string;
}) {
  let score = 10;
  const reasons = ["Lead captured"];
  const source = (input.source ?? "").trim();
  const qr = (input.qrSource ?? "").trim();

  if (qr === "billy_phone_qr" || source === "highlevel_event") {
    score += 25;
    reasons.push(qr === "billy_phone_qr" ? "Billy's phone QR" : "Event lead");
  } else if (source === "website_contact" || source === "public_form") {
    score += 5;
    reasons.push("Came in from the website");
  }

  const size = readCompanySize(input.answers, input.companySize).toLowerCase();
  const nums = size.match(/\d+/g)?.map(Number) ?? [];
  const max = nums.length ? Math.max(...nums) : 0;
  if (max >= 50 || /enterprise|large|50\+/.test(size)) {
    score += 20;
    reasons.push("Larger company");
  } else if (max >= 10 || /medium|growing/.test(size)) {
    score += 12;
    reasons.push("Growing team");
  } else if (max >= 2) {
    score += 6;
    reasons.push("Small team");
  }

  const blob = JSON.stringify(input.answers ?? {}).toLowerCase();
  if (/whatsapp|inbox|manual|overwhelm|follow-?up|hours|leads? falling|too many/.test(blob)) {
    score += 15;
    reasons.push("Audit shows operational pain");
  }
  if (/budget|ready|this month|asap|urgent|buy/.test(blob)) {
    score += 15;
    reasons.push("Buying signal in the audit");
  }

  const recommendations = input.recommendations?.length ?? 0;
  if (recommendations >= 3) {
    score += 10;
    reasons.push("Several AI opportunities");
  } else if (recommendations >= 1) {
    score += 5;
    reasons.push("Audit produced a recommendation");
  }

  if (input.website && input.website.trim()) {
    score += 5;
    reasons.push("Website on file");
  }
  if (input.phone && input.phone.trim()) {
    score += 5;
    reasons.push("Phone on file");
  }

  return { score: Math.min(100, score), reasons };
}

export const HOT_SCORE = 60;
