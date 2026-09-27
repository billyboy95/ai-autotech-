import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { decideAccess, isPublicPath, requiresSession } from "@/lib/auth/gate";
import { safeNextPath } from "@/lib/auth/redirect";
import { enabledAuthProviders } from "@/lib/auth/provider-settings";
import { parseAuthProviders, providerEnabled } from "@/lib/auth/providers";
import { DEFAULT_OWNER_EMAIL, ownerEmailList, parseOwnerEmails, shouldAttachOwner } from "@/lib/auth/owners";
import { expandAccessibleOrgs, roleForOrg, visibleWorkspace } from "@/lib/tenant/access";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import type { Membership, WorkspaceSummary } from "@/lib/tenant/types";

const publicPaths = [
  "/login",
  "/login/forgot",
  "/login/reset",
  "/audit",
  "/api/public/audit",
  "/api/public/leads",
  "/book/ai-autotech-audit",
  "/r/summer",
  "/team/billy",
  "/auth/callback",
  "/favicon.ico",
  "/_next/static/chunk.js",
];

test("public routes do not require a session", () => {
  for (const path of publicPaths) {
    assert.equal(isPublicPath(path), true, path);
    assert.equal(requiresSession(path), false, path);
    assert.deepEqual(decideAccess({ pathname: path, authRequired: true, userId: null }), { type: "continue" });
  }
});

test("an unauthenticated request to /command-centre redirects to /login", () => {
  const decision = decideAccess({ pathname: "/command-centre", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre" });
  const nested = decideAccess({
    pathname: "/command-centre/leads/abc",
    search: "?org=eastc",
    authRequired: true,
    userId: null,
  });
  assert.equal(nested.type, "redirect");
  if (nested.type === "redirect") assert.equal(nested.next, "/command-centre/leads/abc?org=eastc");
  assert.equal(decideAccess({ pathname: "/agency/eastc/settings", authRequired: true, userId: null }).type, "redirect");
  assert.equal(decideAccess({ pathname: "/api/automation/summary", authRequired: true, userId: null }).type, "unauthorized");
  assert.equal(decideAccess({ pathname: "/command-centre", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre", authRequired: false, userId: null }).type, "continue");
});

test("fixture mode without an auth gate leaves the command centre renderable", () => {
  assert.equal(requiresSession("/command-centre"), true);
  assert.equal(decideAccess({ pathname: "/command-centre", authRequired: false, userId: null }).type, "continue");
  assert.equal(decideAccess({ pathname: "/login", authRequired: false, userId: null }).type, "continue");
});

test("login next paths stay on this site", () => {
  assert.equal(safeNextPath("/command-centre/inbox"), "/command-centre/inbox");
  assert.equal(safeNextPath("//evil.example"), "/command-centre");
  assert.equal(safeNextPath("https://evil.example"), "/command-centre");
});

test("OWNER_EMAILS attaches only a listed address that has no membership", () => {
  assert.deepEqual(parseOwnerEmails(" Owner@Example.com, second@example.com "), ["owner@example.com", "second@example.com"]);
  assert.deepEqual(ownerEmailList(undefined), [DEFAULT_OWNER_EMAIL]);
  assert.deepEqual(ownerEmailList("  "), [DEFAULT_OWNER_EMAIL]);
  assert.equal(DEFAULT_OWNER_EMAIL, "billyfaber06@gmail.com");
  assert.equal(shouldAttachOwner({ email: "BillyFaber06@gmail.com", listed: ownerEmailList(""), membershipCount: 0 }), true);
  assert.equal(shouldAttachOwner({ email: "Owner@Example.com", listed: ["owner@example.com"], membershipCount: 0 }), true);
  assert.equal(shouldAttachOwner({ email: "Owner@Example.com", listed: ["owner@example.com"], membershipCount: 1 }), false);
  assert.equal(shouldAttachOwner({ email: "other@example.com", listed: ["owner@example.com"], membershipCount: 0 }), false);
});

test("social buttons follow NEXT_PUBLIC_AUTH_PROVIDERS and stay hidden unless enabled", async () => {
  assert.deepEqual(parseAuthProviders(""), []);
  assert.deepEqual(parseAuthProviders(undefined), []);
  assert.deepEqual(
    parseAuthProviders(" discord, twitter ,nope,azure, google "),
    ["google", "azure", "x", "discord"],
  );
  assert.equal(providerEnabled({ external: { google: true, facebook: false } }, "google"), true);
  assert.equal(providerEnabled({ external: { google: true } }, "facebook"), false);
  assert.equal(providerEnabled(null, "google"), false);

  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    providers: process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
  };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_AUTH_PROVIDERS = "google,facebook";
    assert.deepEqual(await enabledAuthProviders(), []);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.NEXT_PUBLIC_AUTH_PROVIDERS = "";
    globalThis.fetch = (async () => new Response(JSON.stringify({ external: { google: true } }), { status: 200 })) as typeof fetch;
    assert.deepEqual(await enabledAuthProviders(), []);

    process.env.NEXT_PUBLIC_AUTH_PROVIDERS = "facebook,google,discord";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ external: { google: true, facebook: false, discord: true } }), { status: 200 })) as typeof fetch;
    assert.deepEqual(await enabledAuthProviders(), ["google", "discord"]);

    globalThis.fetch = (async () => {
      throw new Error("settings unavailable");
    }) as typeof fetch;
    assert.deepEqual(await enabledAuthProviders(), []);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
    if (previous.providers === undefined) delete process.env.NEXT_PUBLIC_AUTH_PROVIDERS;
    else process.env.NEXT_PUBLIC_AUTH_PROVIDERS = previous.providers;
  }
});

test("a member of org A cannot view org B", () => {
  const [agency] = previewWorkspaces();
  const orgA: WorkspaceSummary = {
    ...agency,
    id: "org-a",
    slug: "org-a",
    name: "Org A",
    orgType: "client",
    parentId: "someone-else",
  };
  const orgB: WorkspaceSummary = {
    ...agency,
    id: "org-b",
    slug: "org-b",
    name: "Org B",
    orgType: "client",
    parentId: "another-parent",
  };
  const memberships: Membership[] = [{ userId: "member-a", orgId: orgA.id, role: "client_admin" }];
  const allowed = expandAccessibleOrgs([orgA, orgB], memberships);
  assert.deepEqual(allowed.map((org) => org.slug), ["org-a"]);
  assert.equal(roleForOrg(orgB, memberships, [orgA, orgB]), null);
  assert.equal(visibleWorkspace(allowed, "org-b"), null);
  assert.equal(visibleWorkspace(allowed, "org-a")?.id, "org-a");
});

test("every command-centre and agency page requires a session, and public intake does not", () => {
  const gated = [
    "/command-centre",
    "/command-centre/pipeline",
    "/command-centre/reviews",
    "/command-centre/leads/abc",
    "/agency",
    "/agency/eastc/settings",
  ];
  for (const path of gated) {
    assert.equal(requiresSession(path), true, path);
    const decision = decideAccess({ pathname: path, authRequired: true, userId: null });
    assert.equal(decision.type, "redirect", path);
    if (decision.type === "redirect") assert.equal(decision.next, path);
  }
  for (const path of ["/api/public/audit", "/api/public/contact", "/api/public/leads", "/r/eastc"]) {
    assert.equal(isPublicPath(path), true, path);
    assert.deepEqual(decideAccess({ pathname: path, authRequired: true, userId: null }), { type: "continue" });
  }
});

test("middleware redirects an unauthenticated /command-centre request to /login", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    vercel: process.env.VERCEL_ENV,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.VERCEL_ENV = "";
  try {
    const { middleware } = await import("@/middleware");
    const denied = await middleware(new NextRequest("http://localhost/command-centre"));
    assert.equal(denied.status, 307);
    const location = denied.headers.get("location") ?? "";
    assert.match(location, /\/login\?next=%2Fcommand-centre$/);

    for (const path of ["/command-centre/pipeline", "/command-centre/reviews", "/agency"]) {
      const response = await middleware(new NextRequest(`http://localhost${path}`));
      assert.equal(response.status, 307, path);
      assert.match(response.headers.get("location") ?? "", new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    }

    const login = await middleware(new NextRequest("http://localhost/login"));
    assert.equal(login.status, 200);

    for (const path of ["/api/public/audit", "/api/public/contact"]) {
      const response = await middleware(new NextRequest(`http://localhost${path}`, { method: "POST" }));
      assert.equal(response.status, 200, path);
    }
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
    if (previous.vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous.vercel;
  }
});

test("middleware still redirects when the runtime has no native WebSocket", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    vercel: process.env.VERCEL_ENV,
    node: process.versions.node,
    webSocket: globalThis.WebSocket,
  };
  Object.defineProperty(process.versions, "node", { value: "20.18.1", configurable: true });
  Object.defineProperty(globalThis, "WebSocket", { value: undefined, configurable: true });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.VERCEL_ENV = "";
  try {
    const { middleware } = await import("@/middleware");
    const denied = await middleware(new NextRequest("http://localhost/command-centre/pipeline"));
    assert.equal(denied.status, 307);
    assert.match(denied.headers.get("location") ?? "", /\/login\?next=%2Fcommand-centre%2Fpipeline$/);
  } finally {
    Object.defineProperty(process.versions, "node", { value: previous.node, configurable: true });
    Object.defineProperty(globalThis, "WebSocket", { value: previous.webSocket, configurable: true });
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
    if (previous.vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous.vercel;
  }
});
