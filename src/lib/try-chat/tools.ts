export const TRY_TOOLS = ["book", "capture_lead"] as const;
export type TryToolName = (typeof TRY_TOOLS)[number];

export type TryToolCall = {
  name: TryToolName;
  nameField: string;
  phone: string;
  email: string;
  company: string;
  note: string;
  when: string;
};

export type ParsedTryTool =
  | { kind: "text" }
  | { kind: "tool"; call: TryToolCall }
  | { kind: "refused"; name: string };

function field(row: Record<string, unknown>, key: string, max: number) {
  const value = row[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function objectFrom(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced?.[1] ?? text).trim();
  if (!source.startsWith("{") || !source.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseTryTool(text: string): ParsedTryTool {
  const row = objectFrom(text.trim());
  if (!row || typeof row.tool !== "string") return { kind: "text" };
  const name = row.tool.trim();
  if (name !== "book" && name !== "capture_lead") return { kind: "refused", name };
  return {
    kind: "tool",
    call: {
      name,
      nameField: field(row, "name", 120),
      phone: field(row, "phone", 40),
      email: field(row, "email", 160),
      company: field(row, "company", 160),
      note: field(row, "note", 500),
      when: field(row, "when", 80),
    },
  };
}
