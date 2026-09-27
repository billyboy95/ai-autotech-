import { hashLiveViewToken, newLiveViewToken } from "@/lib/computers/token";

export type ComputerStatus = "idle" | "running" | "paused" | "error";
export type ComputerProviderName = "fixture" | "e2b";

export type CreateSessionInput = {
  orgId: string;
  botSlug: string;
  botInstallId?: string | null;
};

export type ComputerSession = {
  id: string;
  provider: ComputerProviderName;
  externalId: string;
  status: ComputerStatus;
  sandbox: true;
  orgId: string;
  botSlug: string;
  botInstallId: string | null;
  liveViewTokenHash: string;
};

export interface ComputerProvider {
  readonly name: ComputerProviderName;
  createSession(input: CreateSessionInput): Promise<ComputerSession>;
  pause(sessionId: string): Promise<ComputerSession>;
  resume(sessionId: string): Promise<ComputerSession>;
  getLiveViewUrl(input: { sessionId: string; viewOnly: boolean }): Promise<string>;
  destroy(sessionId: string): Promise<void>;
}

export function computerViewPath(botSlug: string, viewOnly: boolean, provider: ComputerProviderName) {
  const params = new URLSearchParams({
    viewOnly: viewOnly ? "1" : "0",
    provider,
  });
  return `/command-centre/bots/${encodeURIComponent(botSlug)}/computer/view?${params}`;
}

class MemoryComputerProvider implements ComputerProvider {
  readonly name: ComputerProviderName;
  private readonly sessions = new Map<string, ComputerSession>();

  constructor(name: ComputerProviderName) {
    this.name = name;
  }

  async createSession(input: CreateSessionInput): Promise<ComputerSession> {
    const id = `${this.name}:${input.orgId}:${input.botSlug}`;
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const session: ComputerSession = {
      id,
      provider: this.name,
      externalId: `sandbox-${this.name}`,
      status: "idle",
      sandbox: true,
      orgId: input.orgId,
      botSlug: input.botSlug,
      botInstallId: input.botInstallId ?? null,
      liveViewTokenHash: hashLiveViewToken(newLiveViewToken()),
    };
    this.sessions.set(id, session);
    return session;
  }

  async pause(sessionId: string): Promise<ComputerSession> {
    const session = this.require(sessionId);
    session.status = "paused";
    return session;
  }

  async resume(sessionId: string): Promise<ComputerSession> {
    const session = this.require(sessionId);
    session.status = "running";
    return session;
  }

  async getLiveViewUrl(input: { sessionId: string; viewOnly: boolean }): Promise<string> {
    const session = this.require(input.sessionId);
    return computerViewPath(session.botSlug, input.viewOnly, this.name);
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  private require(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("computer session not found");
    return session;
  }
}

/** In-memory desktop. CI and local smoke use this. It never calls a provider. */
export class FixtureComputerProvider extends MemoryComputerProvider {
  constructor() {
    super("fixture");
  }
}

/**
 * Selected only when COMPUTER_PROVIDER_ENABLED is "true" and E2B_API_KEY is set.
 * This stub keeps the fetch function and does not call it. A later change can
 * send the request after Billy approves a paid plan.
 */
export class E2BDesktopProvider implements ComputerProvider {
  readonly name = "e2b" as const;
  private readonly memory = new MemoryComputerProvider("e2b");

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch | null = null,
  ) {}

  async createSession(input: CreateSessionInput): Promise<ComputerSession> {
    this.assertOffline();
    return this.memory.createSession(input);
  }

  async pause(sessionId: string): Promise<ComputerSession> {
    this.assertOffline();
    return this.memory.pause(sessionId);
  }

  async resume(sessionId: string): Promise<ComputerSession> {
    this.assertOffline();
    return this.memory.resume(sessionId);
  }

  async getLiveViewUrl(input: { sessionId: string; viewOnly: boolean }): Promise<string> {
    this.assertOffline();
    return this.memory.getLiveViewUrl(input);
  }

  async destroy(sessionId: string): Promise<void> {
    this.assertOffline();
    await this.memory.destroy(sessionId);
  }

  private assertOffline() {
    if (!this.apiKey.trim()) throw new Error("E2B_API_KEY is unset");
    // Retained so a test can prove the network function stays unused.
    void this.fetchImpl;
  }
}

export function computerProviderEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.COMPUTER_PROVIDER_ENABLED === "true";
}

export function resolveComputerProvider(env: NodeJS.ProcessEnv = process.env): ComputerProvider {
  const key = env.E2B_API_KEY?.trim() ?? "";
  if (computerProviderEnabled(env) && key) return new E2BDesktopProvider(key);
  return new FixtureComputerProvider();
}
