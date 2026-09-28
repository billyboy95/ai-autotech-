import { ZENTRIX_SLUG } from "@/lib/tenant/types";

/** Organisation id inserted for Zentrix Online in the Shopify tenancy seed. Slug remains `zentrix`. */
export const ZENTRIX_ORG_ID = "b1000000-0000-4000-8000-000000000010";

export const ZENTRIX_PACK_BUTTON = "Apply Zentrix pack to Zentrix Online";
export const ZENTRIX_PACK_CONFIRM = "yes";

export type ZentrixPackMode = "fixture" | "sandbox";

export type ZentrixStorePurpose = "priority" | "qa_reference";

export type ZentrixStoreStub = {
  key: "pets" | "kitchens" | "auto";
  label: string;
  handle: string;
  storefrontUrl: string;
  intendedPublicHost: string;
  priority: boolean;
  purpose: ZentrixStorePurpose;
  purposeLabel: string;
  adTarget: boolean;
};

/** Dry Shopify placeholders. Pets and Kitchens are the priority stores. Auto is QA / reference and is not an ad target. */
export const ZENTRIX_STORE_STUBS: ZentrixStoreStub[] = [
  {
    key: "pets",
    label: "Pets",
    handle: "w1y2f0-rk",
    storefrontUrl: "https://w1y2f0-rk.myshopify.com",
    intendedPublicHost: "pets.zentrixonline.co.za",
    priority: true,
    purpose: "priority",
    purposeLabel: "Priority",
    adTarget: true,
  },
  {
    key: "kitchens",
    label: "Kitchens",
    handle: "desj1r-ic",
    storefrontUrl: "https://desj1r-ic.myshopify.com",
    intendedPublicHost: "kitchens.zentrixonline.co.za",
    priority: true,
    purpose: "priority",
    purposeLabel: "Priority",
    adTarget: true,
  },
  {
    key: "auto",
    label: "Auto",
    handle: "80ce1e-p8",
    storefrontUrl: "https://80ce1e-p8.myshopify.com",
    intendedPublicHost: "",
    priority: false,
    purpose: "qa_reference",
    purposeLabel: "QA / reference",
    adTarget: false,
  },
];

export function showZentrixPack(input: {
  surface: "agency" | "settings";
  canManageAgency: boolean;
  slug?: string | null;
}) {
  if (!input.canManageAgency) return false;
  if (input.surface === "settings") return input.slug === ZENTRIX_SLUG;
  return true;
}

export function zentrixPackConfirmationOk(value: FormDataEntryValue | null) {
  return value === ZENTRIX_PACK_CONFIRM;
}

/** Unset, blank, or any value other than true does not store the pack. */
export function zentrixPackMode(env: NodeJS.ProcessEnv = process.env): ZentrixPackMode {
  return String(env.ZENTRIX_WORKSPACE_PACK_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function zentrixPackDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): ZentrixPackMode {
  if (input.tenantMode !== "member") return "fixture";
  return zentrixPackMode(input.env);
}

export function isZentrixOutboundIntent(intent: string) {
  const value = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
  return (
    value === "publish"
    || value === "send"
    || value === "post"
    || value === "post now"
    || value === "go live"
    || value === "golive"
    || value === "ad spend"
    || value === "buy ads"
  );
}

export function zentrixOutboundLabel(intent: string) {
  const value = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (value === "send") return "Send";
  if (value === "go live" || value === "golive") return "Go live";
  if (value === "post" || value === "post now") return "Post";
  if (value === "ad spend" || value === "buy ads") return "Ad spend";
  return "Publish";
}

/** Publish, send, go live, and ad spend never leave this workspace. */
export function refuseZentrixOutbound(intent: string) {
  return {
    refused: true as const,
    queued: 0 as const,
    posted: 0 as const,
    sent: 0 as const,
    charged: false as const,
    published: false as const,
    message: `Billy must approve sends. ${zentrixOutboundLabel(intent)} is refused. Nothing was posted, nothing was charged, and no ad was bought.`,
  };
}

export function missingZentrixPackMigration(message: string) {
  return /apply_zentrix_workspace_pack|zentrix_store_stubs|schema cache|does not exist/i.test(message);
}

export function zentrixPackCatalogue() {
  const encoded = JSON.stringify(ZENTRIX_STORE_STUBS);
  return {
    orgId: ZENTRIX_ORG_ID,
    slug: ZENTRIX_SLUG,
    storeCount: ZENTRIX_STORE_STUBS.length,
    priority: ZENTRIX_STORE_STUBS.filter((store) => store.priority).map((store) => store.key),
    qa: ZENTRIX_STORE_STUBS.filter((store) => store.purpose === "qa_reference").map((store) => store.key),
    adTargets: ZENTRIX_STORE_STUBS.filter((store) => store.adTarget).map((store) => store.key),
    sandbox: true,
    charged: false,
    secretStored: false,
    providerKeysPresent: false,
    sendingEnabled: false,
    hasSecrets: /key=|shpat/i.test(encoded),
  };
}
