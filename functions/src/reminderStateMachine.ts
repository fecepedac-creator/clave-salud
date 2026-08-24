import * as crypto from "crypto";

export type ReminderStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "delivered"
  | "confirmed"
  | "skipped"
  | "failed"
  | "manual_review";

export interface ReminderJobState {
  status: ReminderStatus;
  attemptCount: number;
  leaseOwner?: string | null;
  leaseExpiresAtMs?: number | null;
}

export type ReminderClaimDecision =
  | { action: "claim"; next: ReminderJobState }
  | { action: "skip"; reason: "terminal" | "active_lease" | "requires_review" }
  | { action: "manual_review"; next: ReminderJobState; reason: "expired_send_lease" };

const TERMINAL_STATES = new Set<ReminderStatus>(["sent", "delivered", "confirmed", "skipped"]);

export function decideReminderClaim(params: {
  current?: ReminderJobState | null;
  nowMs: number;
  leaseMs: number;
  leaseOwner: string;
}): ReminderClaimDecision {
  const { current, nowMs, leaseMs, leaseOwner } = params;
  if (!current || current.status === "scheduled") {
    return {
      action: "claim",
      next: {
        status: "processing",
        attemptCount: (current?.attemptCount || 0) + 1,
        leaseOwner,
        leaseExpiresAtMs: nowMs + leaseMs,
      },
    };
  }

  if (TERMINAL_STATES.has(current.status)) {
    return { action: "skip", reason: "terminal" };
  }

  if (current.status === "processing") {
    if (Number(current.leaseExpiresAtMs || 0) > nowMs) {
      return { action: "skip", reason: "active_lease" };
    }
    return {
      action: "manual_review",
      reason: "expired_send_lease",
      next: {
        ...current,
        status: "manual_review",
        leaseOwner: null,
        leaseExpiresAtMs: null,
      },
    };
  }

  return { action: "skip", reason: "requires_review" };
}

export function reminderJobId(parts: string[]): string {
  const digest = crypto
    .createHash("sha256")
    .update(parts.map((part) => part.trim()).join("\u001f"))
    .digest("hex");
  return `reminder_${digest.slice(0, 48)}`;
}

export function redactedReminderErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.name : "UNKNOWN";
  const normalized = raw
    .replace(/[^a-z0-9_]/gi, "_")
    .toUpperCase()
    .slice(0, 64);
  return normalized || "UNKNOWN";
}
