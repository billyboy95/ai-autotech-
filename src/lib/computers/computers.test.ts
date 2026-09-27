import assert from "node:assert/strict";
import test from "node:test";
import {
  E2BDesktopProvider,
  FixtureComputerProvider,
  computerProviderEnabled,
  resolveComputerProvider,
} from "@/lib/computers/provider";
import {
  allowanceHoursForAgent,
  canOpenComputer,
  clampTick,
  computerMeter,
  formatComputerUsage,
} from "@/lib/computers/meter";
import { hashLiveViewToken } from "@/lib/computers/token";
import { AGENT_TIERS, PLATFORM_INCLUDED_HOURS } from "@/lib/pricing/price-sheet";

test("a missing key or a disabled flag stays on the fixture provider", () => {
  assert.equal(computerProviderEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(computerProviderEnabled({ COMPUTER_PROVIDER_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(resolveComputerProvider({} as NodeJS.ProcessEnv).name, "fixture");
  assert.equal(resolveComputerProvider({ E2B_API_KEY: "e2b_test" } as NodeJS.ProcessEnv).name, "fixture");
  assert.equal(
    resolveComputerProvider({ E2B_API_KEY: "", COMPUTER_PROVIDER_ENABLED: "true" } as NodeJS.ProcessEnv).name,
    "fixture",
  );
  assert.equal(
    resolveComputerProvider({
      BROWSERBASE_API_KEY: "bb_test",
      COMPUTER_PROVIDER_ENABLED: "true",
    } as NodeJS.ProcessEnv).name,
    "fixture",
  );
  assert.equal(
    resolveComputerProvider({ E2B_API_KEY: "e2b_test", COMPUTER_PROVIDER_ENABLED: "true" } as NodeJS.ProcessEnv).name,
    "e2b",
  );
});

test("the E2B stub does not call the network", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    throw new Error("network");
  }) as typeof fetch;
  const provider = new E2BDesktopProvider("e2b_test", fetchImpl);
  const session = await provider.createSession({ orgId: "org-1", botSlug: "inbound-lead" });
  assert.equal(session.provider, "e2b");
  assert.equal(session.sandbox, true);
  assert.equal(session.externalId, "sandbox-e2b");
  assert.match(session.liveViewTokenHash, /^[a-f0-9]{64}$/);
  const paused = await provider.pause(session.id);
  assert.equal(paused.status, "paused");
  const running = await provider.resume(session.id);
  assert.equal(running.status, "running");
  const url = await provider.getLiveViewUrl({ sessionId: session.id, viewOnly: true });
  assert.match(url, /\/command-centre\/bots\/inbound-lead\/computer\/view\?/);
  assert.match(url, /viewOnly=1/);
  assert.match(url, /provider=e2b/);
  assert.doesNotMatch(url, /e2b\.dev|api\.e2b|browserbase/i);
  await provider.destroy(session.id);
  await assert.rejects(() => provider.getLiveViewUrl({ sessionId: session.id, viewOnly: true }), /not found/);
  assert.equal(calls, 0);
  await assert.rejects(() => new E2BDesktopProvider("  ").createSession({ orgId: "org-1", botSlug: "ads" }), /unset/);
});

test("the fixture provider returns a sandbox stream and keeps only the token hash", async () => {
  const provider = new FixtureComputerProvider();
  const created = await provider.createSession({ orgId: "org-1", botSlug: "outbound-sales", botInstallId: "install-1" });
  const again = await provider.createSession({ orgId: "org-1", botSlug: "outbound-sales" });
  assert.equal(again.id, created.id);
  assert.equal(created.sandbox, true);
  assert.equal(created.status, "idle");
  assert.match(created.liveViewTokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(created.liveViewTokenHash, hashLiveViewToken(""));
  assert.equal("liveViewToken" in created, false);
  const url = await provider.getLiveViewUrl({ sessionId: created.id, viewOnly: false });
  assert.match(url, /viewOnly=0/);
  assert.match(url, /provider=fixture/);
  await provider.destroy(created.id);
});

test("allowances match the price sheet and over-allowance pauses without spend", () => {
  assert.equal(allowanceHoursForAgent("onboarding", "onboarding"), AGENT_TIERS.starter.hours);
  assert.equal(allowanceHoursForAgent("outbound-sales", "sales"), AGENT_TIERS.pro.hours);
  assert.equal(allowanceHoursForAgent("receptionist", "customer-service"), AGENT_TIERS.always_on.hours);
  assert.equal(allowanceHoursForAgent("inbound-lead", "sales"), PLATFORM_INCLUDED_HOURS);
  assert.equal(AGENT_TIERS.starter.hours, 5);
  assert.equal(AGENT_TIERS.pro.hours, 12);
  assert.equal(AGENT_TIERS.always_on.hours, 40);

  const under = computerMeter({ allowanceSeconds: 5 * 3600, usedSeconds: 60, status: "running" });
  assert.equal(under.overAllowance, false);
  assert.equal(under.status, "running");
  assert.equal(under.sandbox, true);
  const over = computerMeter({ allowanceSeconds: 5 * 3600, usedSeconds: 5 * 3600 + 1, status: "running" });
  assert.equal(over.overAllowance, true);
  assert.equal(over.status, "paused");
  assert.equal(formatComputerUsage(0), "0 min");
  assert.equal(formatComputerUsage(60), "1 min");
  assert.equal(clampTick("-3"), 0);
  assert.equal(clampTick("2.9"), 2);
});

test("agency owners and client admins can open; assigned-only clients need an assignment", () => {
  assert.equal(canOpenComputer({ role: "agency_owner", assignedOnly: false, assignedUserId: null, viewerUserId: null }), true);
  assert.equal(canOpenComputer({ role: "agency_staff", assignedOnly: false, assignedUserId: null, viewerUserId: "staff" }), true);
  assert.equal(canOpenComputer({ role: "client_admin", assignedOnly: false, assignedUserId: null, viewerUserId: "admin" }), true);
  assert.equal(canOpenComputer({ role: "client_user", assignedOnly: false, assignedUserId: null, viewerUserId: "user" }), true);
  assert.equal(canOpenComputer({ role: "client_user", assignedOnly: true, assignedUserId: "user", viewerUserId: "user" }), true);
  assert.equal(canOpenComputer({ role: "client_user", assignedOnly: true, assignedUserId: null, viewerUserId: "user" }), false);
  assert.equal(canOpenComputer({ role: "client_user", assignedOnly: true, assignedUserId: "other", viewerUserId: "user" }), false);
  assert.equal(canOpenComputer({ role: null, assignedOnly: false, assignedUserId: null, viewerUserId: null }), false);
});
