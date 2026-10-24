import type { TryGrounding } from "@/lib/try-chat/prompt";
import type { TryLinkState } from "@/lib/try-chat/access";
import type { SandboxBookingPlan } from "@/lib/try-chat/booking";
import type { SandboxLeadPlan } from "@/lib/try-chat/lead";

export type TryHistoryMessage = { role: "user" | "assistant"; content: string };

export type TryLoadedLink = {
  link: TryLinkState;
  grounding: TryGrounding;
  history: TryHistoryMessage[];
};

export type TryCommitInput = {
  linkId: string;
  userMessage: string;
  assistantMessage: string;
  booking: SandboxBookingPlan | null;
  lead: SandboxLeadPlan | null;
  now: Date;
};

export type TryCommitResult =
  | { ok: true; usedMessages: number }
  | { ok: false; code: "capped" | "revoked" | "expired" | "missing" | "tool_failed"; message: string };

export type TryStore = {
  load(input: { slug: string; tokenHash: string }): Promise<TryLoadedLink | null>;
  commit(input: TryCommitInput): Promise<TryCommitResult>;
};
