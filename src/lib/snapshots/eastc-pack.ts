import { EDUCATION_PAYLOAD, EDUCATION_SNAPSHOT_ID } from "@/lib/snapshots/catalog";
import { EASTC_SLUG } from "@/lib/tenant/types";

/** Organisation id inserted for EASTC in agency tenancy. Slug remains `eastc`. */
export const EASTC_ORG_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

export const EDUCATION_PACK_BUTTON = "Apply Education pack to EASTC";
export const EDUCATION_PACK_CONFIRM = "yes";

export function showEducationPack(input: {
  surface: "agency" | "settings";
  canManageAgency: boolean;
  slug?: string | null;
}) {
  if (!input.canManageAgency) return false;
  if (input.surface === "settings") return input.slug === EASTC_SLUG;
  return true;
}

export function educationPackConfirmationOk(value: FormDataEntryValue | null) {
  return value === EDUCATION_PACK_CONFIRM;
}

export function educationPackTouchesOnlyCatalogue() {
  const payload = EDUCATION_PAYLOAD;
  const encoded = JSON.stringify(payload);
  return {
    snapshotId: EDUCATION_SNAPSHOT_ID,
    orgId: EASTC_ORG_ID,
    slug: EASTC_SLUG,
    workflowKey: payload.workflows[0]?.asset_key ?? "",
    workflowActive: payload.workflows[0]?.active ?? true,
    sequenceActive: payload.sequences[0]?.active ?? true,
    hasContactsKey: encoded.includes("contacts"),
    hasSecrets: /secret|token|password|credential/i.test(encoded),
  };
}
