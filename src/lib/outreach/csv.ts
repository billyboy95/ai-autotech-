/** Minimal RFC 4180 CSV reader plus the brokers.csv column mapping. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const HEADERS: Record<string, string[]> = {
  business: ["business", "company", "name"],
  fsp_number: ["fsp number (from own site)", "fsp number", "fsp"],
  area: ["area", "city"],
  website: ["website"],
  email: ["public business email", "email"],
  phone: ["phone"],
  contact_name: ["decision-maker (only if publicly listed)", "decision-maker", "contact"],
  contact_title: ["decision-maker title", "title"],
  source_url: ["source url", "source"],
  hook: ["personalisation hook (compliment)", "personalisation hook", "hook", "personalised opening line"],
  priority: ["priority"],
  channel: ["channel"],
  notes: ["notes"],
};

export type OutreachImportRow = Record<keyof typeof HEADERS, string>;

function channelOf(value: string) {
  const v = value.toLowerCase();
  if (v.startsWith("email")) return "email";
  if (v.includes("form")) return "form";
  if (v.includes("phone")) return "phone";
  if (v === "dm" || v === "warm") return v;
  return "email";
}

export function mapOutreachCsv(text: string): OutreachImportRow[] {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const lower = head.map((h) => h.trim().toLowerCase());
  const index = Object.fromEntries(
    Object.entries(HEADERS).map(([key, names]) => [key, lower.findIndex((h) => names.includes(h))]),
  ) as Record<keyof typeof HEADERS, number>;
  if (index.business < 0) return [];
  return body
    .map((cells) => {
      const get = (key: keyof typeof HEADERS) => (index[key] >= 0 ? (cells[index[key]] ?? "").trim() : "");
      const priority = get("priority").toUpperCase();
      return {
        business: get("business").slice(0, 200),
        fsp_number: get("fsp_number").slice(0, 40),
        area: get("area").slice(0, 120),
        website: get("website").slice(0, 300),
        email: get("email").toLowerCase().slice(0, 200),
        phone: get("phone").slice(0, 40),
        contact_name: get("contact_name").slice(0, 160),
        contact_title: get("contact_title").slice(0, 160),
        source_url: get("source_url").slice(0, 300),
        hook: get("hook").slice(0, 600),
        priority: ["A", "B", "C"].includes(priority) ? priority : "B",
        channel: channelOf(get("channel") || (get("email") ? "email" : "phone")),
        notes: get("notes").slice(0, 4000),
      };
    })
    .filter((row) => row.business.length > 0);
}
