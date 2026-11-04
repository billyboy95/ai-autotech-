import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SeatBillingPanel } from "@/components/seat-billing-panel";
import { PAYFAST_SANDBOX_PROCESS_URL } from "@/lib/billing/flag";
import { createPayfastProvider } from "@/lib/billing/payfast";
import { emptyBook } from "@/lib/billing/book";
import {
  applySeatBilling,
  countConnectedWhatsappNumbers,
  countTeamSeats,
  isTeamSeatBillingEnabled,
  placeholderAddonCents,
  resolveCheckoutPlan,
  seatCheckoutRefusal,
} from "@/lib/billing/seats";
import { CRM_PLANS, EXTRA_TEAM_SEAT_CENTS, EXTRA_WHATSAPP_NUMBER_CENTS, SEAT_ADDON_LINES } from "@/lib/pricing/price-sheet";

const PLATFORM = { code: "platform", name: "Platform", priceCents: 29900, interval: "month" };
const SANDBOX_ENV = {
  BILLING_SANDBOX: "true",
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "sandbox-key",
  PAYFAST_PASSPHRASE: "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  PAYFAST_MODE: "sandbox",
};

test("team seat billing stays off unless the env value is the exact string true", () => {
  assert.equal(isTeamSeatBillingEnabled({}), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: "" }), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: "false" }), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: "TRUE" }), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: " true" }), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: "true " }), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: "1" }), false);
  assert.equal(isTeamSeatBillingEnabled({ TEAM_SEAT_BILLING_ENABLED: "true" }), true);
});

test("flag off hides seat lines even when the catalogue rows are already loaded", () => {
  const model = applySeatBilling(
    {
      plans: [
        PLATFORM,
        { code: "extra_team_seat", name: "Extra team seat (placeholder)", priceCents: EXTRA_TEAM_SEAT_CENTS, interval: "month" },
        { code: "extra_whatsapp_number", name: "Extra WhatsApp number (placeholder)", priceCents: EXTRA_WHATSAPP_NUMBER_CENTS, interval: "month" },
      ],
    },
    {
      env: { TEAM_SEAT_BILLING_ENABLED: "false" },
      membershipRows: [{ user_id: "member-1" }, { user_id: "member-2" }],
      connectionRows: [{ channel: "whatsapp", status: "connected", identifier: "27821234567" }],
    },
  );
  assert.equal(model.seatBilling, null);
  assert.deepEqual(model.plans.map((plan) => plan.code), ["platform"]);
  assert.equal(renderToStaticMarkup(SeatBillingPanel({ seat: model.seatBilling })), "");
  assert.equal(CRM_PLANS.some((plan) => plan.code === "extra_team_seat" || plan.code === "extra_whatsapp_number"), false);
});

test("flag on shows seat and WhatsApp counts plus placeholder lines", () => {
  const model = applySeatBilling(
    { plans: [PLATFORM] },
    {
      env: { TEAM_SEAT_BILLING_ENABLED: "true" },
      membershipRows: [{ user_id: "member-1" }, { user_id: "member-1" }, { userId: "member-2" }],
      connectionRows: [
        { channel: "whatsapp", status: "connected", identifier: "27821234567" },
        { channel: "whatsapp", status: "connected", identifier: "27821234567" },
        { channel: "whatsapp", status: "connected", identifier: "" },
        { channel: "whatsapp", status: "pending", identifier: "27820000000" },
        { channel: "email", status: "connected", identifier: "ops@example.com" },
      ],
    },
  );
  assert.equal(countTeamSeats(model.seatBilling ? [{ user_id: "member-1" }, { user_id: "member-1" }, { userId: "member-2" }] : []), 2);
  assert.equal(model.seatBilling?.teamSeats, 2);
  assert.equal(model.seatBilling?.whatsappNumbers, 2);
  assert.deepEqual(
    model.seatBilling?.plans.map((plan) => [plan.code, plan.priceCents]),
    [
      ["extra_team_seat", EXTRA_TEAM_SEAT_CENTS],
      ["extra_whatsapp_number", EXTRA_WHATSAPP_NUMBER_CENTS],
    ],
  );
  assert.equal(model.plans[0]?.code, "platform");
  const html = renderToStaticMarkup(SeatBillingPanel({ seat: model.seatBilling }));
  assert.match(html, /data-seat-billing="on"/);
  assert.match(html, /data-seat-count="2"/);
  assert.match(html, /data-whatsapp-count="2"/);
  assert.match(html, /Extra team seat \(placeholder\)/);
  assert.match(html, /Extra WhatsApp number \(placeholder\)/);
  assert.match(html, /Placeholder/);
  assert.match(html, /VAT excluded/);
  assert.doesNotMatch(html, /VAT</);
  assert.equal(html.includes("15%"), false);
  const dry = placeholderAddonCents(2, 1);
  assert.equal(dry.seatCents, EXTRA_TEAM_SEAT_CENTS * 2);
  assert.equal(dry.numberCents, EXTRA_WHATSAPP_NUMBER_CENTS);
  assert.equal(dry.totalCents, dry.seatCents + dry.numberCents);
  assert.equal(dry.placeholder, true);
  assert.equal(dry.charged, false);
  assert.deepEqual(placeholderAddonCents(-3, Number.NaN), {
    seatCents: 0,
    numberCents: 0,
    totalCents: 0,
    placeholder: true,
    charged: false,
    currency: "ZAR",
  });
});

test("missing membership or channel tables stay empty instead of showing zero", () => {
  const model = applySeatBilling(
    { plans: [PLATFORM] },
    {
      env: { TEAM_SEAT_BILLING_ENABLED: "true" },
      membershipMissing: true,
      connectionMissing: true,
    },
  );
  assert.equal(model.seatBilling?.teamSeats, null);
  assert.equal(model.seatBilling?.whatsappNumbers, null);
  assert.match(model.seatBilling?.notice || "", /Memberships could not be read/);
  assert.match(model.seatBilling?.notice || "", /Channel connections could not be read/);
  const html = renderToStaticMarkup(SeatBillingPanel({ seat: model.seatBilling }));
  assert.match(html, /data-seat-count="unavailable"/);
  assert.match(html, /data-whatsapp-count="unavailable"/);
  assert.match(html, /data-plan="extra_team_seat"/);
  const preview = applySeatBilling({ plans: [PLATFORM] }, { env: { TEAM_SEAT_BILLING_ENABLED: "true" }, preview: true });
  assert.equal(preview.seatBilling?.teamSeats, null);
  assert.match(preview.seatBilling?.notice || "", /Preview only/);
});

test("seat checkout refuses a closed flag, live mode, and a live merchant, and stays on the sandbox host", () => {
  assert.match(seatCheckoutRefusal("extra_team_seat", { ...SANDBOX_ENV, TEAM_SEAT_BILLING_ENABLED: "false" }) || "", /Team seat billing is off/);
  assert.equal(seatCheckoutRefusal("platform", { ...SANDBOX_ENV, TEAM_SEAT_BILLING_ENABLED: "true" }), null);
  assert.match(
    seatCheckoutRefusal("extra_whatsapp_number", { ...SANDBOX_ENV, TEAM_SEAT_BILLING_ENABLED: "true", PAYFAST_MODE: "live" }) || "",
    /sandbox/,
  );
  assert.match(
    seatCheckoutRefusal("extra_team_seat", { ...SANDBOX_ENV, TEAM_SEAT_BILLING_ENABLED: "true", PAYFAST_MERCHANT_ID: "99999999" }) || "",
    /10000100/,
  );

  const closed = resolveCheckoutPlan("extra_team_seat", null, { TEAM_SEAT_BILLING_ENABLED: "true" });
  assert.equal(closed.ok, false);
  if (!closed.ok) assert.match(closed.message, /BILLING_SANDBOX/);

  const hidden = resolveCheckoutPlan("extra_team_seat", { code: "extra_team_seat", name: "Extra team seat (placeholder)", price_cents: 14900, interval: "month" }, SANDBOX_ENV);
  assert.equal(hidden.ok, false);

  const fromSheet = resolveCheckoutPlan("extra_whatsapp_number", null, { ...SANDBOX_ENV, TEAM_SEAT_BILLING_ENABLED: "true" });
  assert.equal(fromSheet.ok, true);
  if (fromSheet.ok) {
    assert.equal(fromSheet.plan.priceCents, EXTRA_WHATSAPP_NUMBER_CENTS);
    assert.equal(fromSheet.plan.currency, "ZAR");
    const checkout = createPayfastProvider(emptyBook(), { ...SANDBOX_ENV, TEAM_SEAT_BILLING_ENABLED: "true" }).createCheckout(
      { id: "org-1", name: "EASTC", email: "billing@eastc.example" },
      fromSheet.plan,
    );
    assert.equal(checkout.charged, false);
    assert.equal(checkout.sandbox, true);
    assert.equal(checkout.actionUrl, PAYFAST_SANDBOX_PROCESS_URL);
    assert.equal(checkout.fields?.custom_str3, "sandbox");
    assert.equal(checkout.fields?.custom_str2, "extra_whatsapp_number");
  }

  const platform = resolveCheckoutPlan("platform", { code: "platform", name: "Platform", price_cents: 29900, interval: "month" }, SANDBOX_ENV);
  assert.equal(platform.ok, true);
  if (platform.ok) assert.equal(platform.plan.code, "platform");
});

test("the seat migration is unapplied placeholder SQL and the billing screen stays gated", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261117120000_team_seat_billing.sql", import.meta.url), "utf8");
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../../components/workspace-billing-panel.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../../app/actions/billing.ts", import.meta.url), "utf8");
  const example = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/www\.payfast\.co\.za/i.test(sql), false);
  assert.match(sql, /price_placeholder/);
  assert.match(sql, /vat_excluded/);
  assert.match(sql, new RegExp(String(EXTRA_TEAM_SEAT_CENTS)));
  assert.match(sql, new RegExp(String(EXTRA_WHATSAPP_NUMBER_CENTS)));
  assert.match(sql, /Not applied/);
  for (const line of SEAT_ADDON_LINES) {
    assert.match(sql, new RegExp(line.code));
    assert.match(sql, new RegExp(line.name.replace(/[()]/g, "\\$&")));
  }
  assert.match(order, /20261117120000_team_seat_billing\.sql/);
  assert.match(order, /not applied/i);
  assert.equal(order.includes("37. `supabase/migrations/20261117120000_team_seat_billing.sql`"), false);
  assert.match(panel, /billing\.seatBilling \? <SeatBillingPanel/);
  assert.match(action, /seatCheckoutRefusal/);
  assert.match(action, /resolveCheckoutPlan/);
  assert.equal(/www\.payfast\.co\.za/.test(action), false);
  assert.match(example, /TEAM_SEAT_BILLING_ENABLED=/);
  assert.equal(countConnectedWhatsappNumbers([{ channel: "sms", status: "connected", identifier: "27820000000" }]), 0);
});
