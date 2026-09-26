/**
 * Phase 1 modules should pass every business query through this helper so a
 * lead, deal, message, template, or campaign never leaves its workspace.
 * Agency staff reach a client org only after access.ts has allowed that org id.
 */
export function scopeToOrg<T extends { eq: (column: string, value: string) => T }>(query: T, orgId: string) {
  return query.eq("org_id", orgId);
}
