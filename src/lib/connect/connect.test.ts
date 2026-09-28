import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONNECT_ACCOUNTS, resolveConnectState } from "@/lib/connect/accounts";
import { draftContacts, previewContactImport } from "@/lib/connect/import-csv";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { PLATFORM_FEE_CENTS, AGENT_TIERS, teamDiscountPercent } from "@/lib/pricing/price-sheet";

const campaignCsv = [
  "name,business,niche,website,phone,email,opening line,consent_basis",
  "Thabo Molefe,Ndlovu Dental,dental,https://ndlovu.example,0825550101,thabo@ndlovu.example,Front desk,consent",
  "Ada Lovelace,Clinic,clinic,https://clinic.example,,ada@clinic.example,Hello,existing_customer",
  "No Consent,Clinic,clinic,https://clinic.example,0825550102,noconsent@clinic.example,Hello,",
  "Opt Out,Clinic,clinic,https://clinic.example,0825550103,optout@clinic.example,Hello,opted_out",
].join("\n");

test("connect cards cover the full account list and do not phase it", () => {
  assert.deepEqual(CONNECT_ACCOUNTS.map((account) => account.key), [
    "gmail",
    "whatsapp",
    "sms",
    "meta",
    "google_calendar",
    "tiktok",
    "linkedin",
  ]);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label.includes("Gmail")), true);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label.includes("WhatsApp")), true);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label === "SMS"), true);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label.includes("Facebook")), true);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label.includes("Calendar")), true);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label.includes("TikTok")), true);
  assert.equal(CONNECT_ACCOUNTS.some((account) => account.label === "LinkedIn"), true);
});

test("card state is connect, needs keys, or connected without inventing a secret", () => {
  const email = CONNECT_ACCOUNTS[0];
  const calendar = CONNECT_ACCOUNTS.find((account) => account.key === "google_calendar");
  const meta = CONNECT_ACCOUNTS.find((account) => account.key === "meta");
  assert.ok(email && calendar && meta);
  assert.equal(resolveConnectState({ account: email, checklistStatus: null, connections: [] }), "connect");
  assert.equal(resolveConnectState({
    account: email,
    checklistStatus: "needs_keys",
    connections: [{ channel: "email", provider: "resend", status: "pending", hasSecret: false }],
  }), "needs_keys");
  assert.equal(resolveConnectState({
    account: email,
    checklistStatus: null,
    connections: [{ channel: "email", provider: "resend", status: "connected", hasSecret: false }],
  }), "needs_keys");
  assert.equal(resolveConnectState({
    account: email,
    checklistStatus: "needs_keys",
    connections: [{ channel: "email", provider: "resend", status: "connected", hasSecret: true }],
  }), "connected");
  assert.equal(resolveConnectState({
    account: calendar,
    checklistStatus: "needs_keys",
    connections: [],
  }), "needs_keys");
  assert.equal(resolveConnectState({
    account: meta,
    checklistStatus: "needs_keys",
    connections: [
      { channel: "facebook", provider: "meta", status: "connected", hasSecret: true },
      { channel: "instagram", provider: "meta", status: "pending", hasSecret: false },
    ],
  }), "needs_keys");
  assert.equal(resolveConnectState({
    account: meta,
    checklistStatus: null,
    connections: [
      { channel: "facebook", provider: "meta", status: "connected", hasSecret: true },
      { channel: "instagram", provider: "meta", status: "connected", hasSecret: true },
    ],
  }), "connected");
});

test("contact import maps the consent-ready campaign CSV and does not queue a send", () => {
  const preview = previewContactImport(campaignCsv);
  assert.equal(preview.error, "");
  assert.equal(preview.columns.find((column) => column.header === "name")?.field, "name");
  assert.equal(preview.columns.find((column) => column.header === "phone")?.field, "phone");
  assert.equal(preview.columns.find((column) => column.header === "email")?.field, "email");
  assert.equal(preview.columns.find((column) => column.header === "consent_basis")?.field, "consent");
  assert.equal(preview.columns.find((column) => column.header === "opening line")?.field, "ignored");
  assert.equal(preview.ready, 2);
  assert.equal(preview.blocked, 2);
  const drafts = draftContacts(preview);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0]?.consent_basis, "consent");
  assert.equal(drafts[1]?.consent_basis, "existing_customer");
  assert.equal(drafts.some((row) => "send" in row), false);
  const missing = previewContactImport("name,phone,email\nAda,082,ada@example.com\n");
  assert.match(missing.error, /consent_basis/);
  assert.deepEqual(draftContacts(missing), []);
});

test("connect and import copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/connect/accounts.ts",
    "src/lib/connect/import-csv.ts",
    "src/lib/connect/load.ts",
    "src/app/actions/connect.ts",
    "src/components/connect/account-cards.tsx",
    "src/components/connect/import-wizard.tsx",
    "src/app/command-centre/connect-accounts/page.tsx",
    "src/app/command-centre/import-contacts/page.tsx",
    "docs/connect-import.md",
    "supabase/migrations/20261030120000_phase5c_connect_import.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|tiktok\.com|api\.whatsapp|payfast/i.test(text), false, file);
    assert.equal(/store_channel_secret/.test(text), false, file);
  }
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step23 = order.indexOf("23. `supabase/migrations/20261029120000_phase5b_lead_onboarding.sql`");
  const step24 = order.indexOf("24. `supabase/migrations/20261030120000_phase5c_connect_import.sql`");
  assert.ok(step23 >= 0);
  assert.ok(step24 > step23);
  assert.equal(PLATFORM_FEE_CENTS, 29_900);
  assert.equal(AGENT_TIERS.starter.cents, 69_900);
  assert.equal(AGENT_TIERS.pro.cents, 149_900);
  assert.equal(AGENT_TIERS.always_on.cents, 499_900);
  assert.equal(teamDiscountPercent(3), 10);
  assert.equal(teamDiscountPercent(5), 15);
  assert.equal(teamDiscountPercent(10), 20);
});
