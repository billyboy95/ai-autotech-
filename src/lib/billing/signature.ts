import { createHash } from "node:crypto";

/** PHP urlencode, which is what PayFast uses for signatures. Spaces become +. */
export function payfastEncode(value: string) {
  return encodeURIComponent(value.trim())
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

export function payfastSignature(fields: Record<string, string>, order: string[], passphrase = "") {
  const parts: string[] = [];
  for (const key of order) {
    if (key === "signature") continue;
    const value = fields[key];
    if (value == null || String(value).trim() === "") continue;
    parts.push(`${key}=${payfastEncode(String(value))}`);
  }
  let query = parts.join("&");
  if (passphrase.trim()) {
    query += `&passphrase=${payfastEncode(passphrase.trim())}`;
  }
  return createHash("md5").update(query).digest("hex");
}

export function parsePayfastBody(raw: string) {
  const params = new URLSearchParams(raw);
  const fields: Record<string, string> = {};
  const order: string[] = [];
  for (const [key, value] of params.entries()) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) order.push(key);
    fields[key] = value;
  }
  return { fields, order };
}
