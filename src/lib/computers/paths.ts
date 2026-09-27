export function computerPagePath(
  botSlug: string,
  input: { org?: string | null; viewOnly: boolean; tick: number; notice?: string | null },
) {
  const params = new URLSearchParams();
  if (input.org) params.set("org", input.org);
  params.set("viewOnly", input.viewOnly ? "1" : "0");
  if (input.tick > 0) params.set("tick", String(input.tick));
  if (input.notice) params.set("notice", input.notice);
  const query = params.toString();
  return `/command-centre/bots/${encodeURIComponent(botSlug)}/computer${query ? `?${query}` : ""}`;
}
