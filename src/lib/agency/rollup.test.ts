import assert from "node:assert/strict";
import test from "node:test";
import { deliverMessage } from "@/lib/automation/send";
import {
  eastcPeriodFixture,
  periodMetrics,
  redFlags,
  zentrixPeriodFixture,
} from "@/lib/agency/metrics";
import { brandedEmailFrom } from "@/lib/brand/email-from";
import { brandHostFrom, stubPath } from "@/lib/brand/host";
import { classicForBrand, loginCopy, mentionsPlatform, presentBrand, recordsForWorkspace } from "@/lib/brand/present";
import { applyBrandLock } from "@/lib/tenant/context";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import type { WorkspaceResolution } from "@/lib/tenant/types";

test("eastc period numbers are stable for the agency rollup and the workspace dashboard", () => {
  const metrics = periodMetrics(eastcPeriodFixture);
  assert.equal(metrics.newLeads, 3);
  assert.equal(metrics.medianFirstResponseSeconds, 150);
  assert.equal(metrics.openPipelineZar, 1400);
  assert.equal(metrics.wonZar, 2500);
  assert.deepEqual(metrics.messagesByChannel, { whatsapp: 5, sms: 2, email: 1, facebook: 0, instagram: 0 });
  assert.equal(metrics.waSmsCostCents, 49);
  assert.equal(metrics.waSmsBilledCents, 98);
  assert.equal(metrics.optOutRate, 0.5);
  assert.equal(metrics.blockedConsentCount, 2);
  assert.equal(metrics.failedWorkflowRuns, 1);
  assert.equal(metrics.outboxHeld, 2);
  assert.equal(metrics.unansweredOver2h, 1);
  assert.equal(metrics.failedMessages, 1);
  assert.deepEqual(metrics.sparkline, [1, 1, 1]);
  assert.deepEqual(redFlags(metrics), ["no_reply_2h", "failures", "past_due"]);
});

test("zentrix period numbers stay separate from eastc", () => {
  const metrics = periodMetrics(zentrixPeriodFixture);
  assert.equal(metrics.newLeads, 1);
  assert.equal(metrics.medianFirstResponseSeconds, null);
  assert.equal(metrics.openPipelineZar, 100);
  assert.deepEqual(metrics.sparkline, [0, 1, 0]);
  assert.deepEqual(redFlags(metrics), []);
});

test("a resolved client host keeps that workspace and hides the platform name", () => {
  const [agency, eastc, zentrix] = previewWorkspaces();
  const open: WorkspaceResolution = {
    mode: "member",
    active: agency,
    workspaces: [
      { slug: agency.slug, name: agency.name, orgType: "agency" },
      { slug: eastc.slug, name: eastc.name, orgType: "client" },
      { slug: zentrix.slug, name: zentrix.name, orgType: "client" },
    ],
    role: "agency_owner",
    userEmail: "owner@aiautotech.co.za",
    canManageAgency: true,
    scoped: true,
    requiresLogin: false,
    requestedSlug: null,
    brandLocked: false,
    brandHost: "crm.eastc.test",
  };
  const locked = applyBrandLock(open, "eastc", [agency, eastc, zentrix], "agency_owner");
  assert.equal(locked.brandLocked, true);
  assert.deepEqual(locked.workspaces.map((item) => item.slug), ["eastc"]);
  assert.equal(locked.active.slug, "eastc");
  assert.equal(locked.canManageAgency, false);
  assert.equal(JSON.stringify(locked.workspaces).includes("zentrix"), false);

  const denied = applyBrandLock(open, "eastc", [agency, eastc, zentrix], null);
  assert.equal(denied.requiresLogin, true);
  assert.deepEqual(denied.workspaces, []);

  const rows = recordsForWorkspace(
    [
      { orgId: eastc.id, name: "EASTC lead" },
      { orgId: zentrix.id, name: "Zentrix lead" },
    ],
    eastc.id,
    true,
  );
  assert.deepEqual(rows.map((row) => row.name), ["EASTC lead"]);

  const classic = classicForBrand(
    {
      leads: [],
      clients: [
        { id: "eastc", name: "EASTC Holdings" },
        { id: "other", name: "Ndlovu Dental" },
      ],
      jobs: [
        { id: "1", client: "EASTC Holdings" },
        { id: "2", client: "Ndlovu Dental" },
      ],
      invoices: [{ id: "3", client: "Ndlovu Dental" }],
    },
    "eastc",
  );
  assert.deepEqual(classic.clients.map((client) => client.name), ["EASTC Holdings"]);
  assert.equal(classic.jobs.length, 1);
  assert.equal(classic.invoices.length, 0);

  const brand = presentBrand(eastc);
  const copy = loginCopy(brand);
  assert.equal(copy.showPlatform, false);
  assert.equal(mentionsPlatform(`${copy.title} ${copy.body}`), false);
  assert.equal(mentionsPlatform(brand.productName), false);
});

test("the host stub and email sender stay on the workspace brand", () => {
  assert.deepEqual(stubPath("/d/crm.eastc.test/login"), { host: "crm.eastc.test", pathname: "/login" });
  assert.equal(brandHostFrom({ host: "localhost:3000", cookie: "crm.zentrix.test" }), "crm.zentrix.test");
  assert.equal(brandHostFrom({ header: "crm.eastc.test", host: "aiautotech.co.za" }), "crm.eastc.test");
  const from = brandedEmailFrom({
    senderName: "EASTC",
    address: "AI AutoTech <hello@eastc.test>",
    showPlatformName: false,
  });
  assert.equal(from, "EASTC <hello@eastc.test>");
  assert.equal(mentionsPlatform(from), false);
});

test("a client send does not put AI AutoTech on the email", async () => {
  let from = "";
  let subject = "";
  const result = await deliverMessage(
    { channel: "email", to: "person@eastc.test", subject: "", body: "Hello", senderName: "EASTC", showPlatformName: false },
    { AUTOMATION_SEND_ENABLED: "true", RESEND_API_KEY: "test-key", RESEND_FROM: "hello@eastc.test" },
    async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { from: string; subject: string };
      from = body.from;
      subject = body.subject;
      return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
    },
  );
  assert.equal(result.status, "sent");
  assert.equal(from, "EASTC <hello@eastc.test>");
  assert.equal(subject, "EASTC");
  assert.equal(mentionsPlatform(`${from} ${subject}`), false);
});
