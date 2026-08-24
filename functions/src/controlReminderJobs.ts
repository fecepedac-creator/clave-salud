import { FieldValue, Timestamp, db } from "./firebaseAdmin";
import {
  decideReminderClaim,
  reminderJobId,
  type ReminderJobState,
  type ReminderStatus,
} from "./reminderStateMachine";

const REMINDER_LEASE_MS = 10 * 60 * 1000;

interface ControlReminderIdentity {
  centerId: string;
  patientId: string;
  consultationId: string;
  targetDate: string;
}

export interface ClaimedControlReminder {
  jobId: string;
  claimed: boolean;
  reason?: string;
}

function referenceFor(identity: ControlReminderIdentity) {
  const jobId = reminderJobId([
    "control_follow_up",
    identity.centerId,
    identity.patientId,
    identity.consultationId,
    identity.targetDate,
  ]);
  return {
    jobId,
    ref: db.collection("centers").doc(identity.centerId).collection("reminderJobs").doc(jobId),
  };
}

function toState(data: FirebaseFirestore.DocumentData | undefined): ReminderJobState | null {
  if (!data) return null;
  return {
    status: String(data.status || "scheduled") as ReminderStatus,
    attemptCount: Number(data.attemptCount || 0),
    leaseOwner: typeof data.leaseOwner === "string" ? data.leaseOwner : null,
    leaseExpiresAtMs: data.leaseExpiresAt?.toMillis?.() ?? null,
  };
}

export async function claimControlReminder(
  identity: ControlReminderIdentity,
  leaseOwner: string,
  nowMs = Date.now()
): Promise<ClaimedControlReminder> {
  const { jobId, ref } = referenceFor(identity);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const decision = decideReminderClaim({
      current: toState(snapshot.data()),
      nowMs,
      leaseMs: REMINDER_LEASE_MS,
      leaseOwner,
    });

    if (decision.action === "skip") {
      return { jobId, claimed: false, reason: decision.reason };
    }

    if (decision.action === "manual_review") {
      transaction.set(
        ref,
        {
          status: decision.next.status,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: "LEASE_EXPIRED_AFTER_SEND_ATTEMPT",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { jobId, claimed: false, reason: decision.reason };
    }

    transaction.set(
      ref,
      {
        kind: "control_follow_up",
        idempotencyHash: jobId.replace(/^reminder_/, ""),
        targetDate: identity.targetDate,
        status: decision.next.status,
        attemptCount: decision.next.attemptCount,
        leaseOwner,
        leaseExpiresAt: Timestamp.fromMillis(Number(decision.next.leaseExpiresAtMs)),
        sendAttemptedAt: FieldValue.serverTimestamp(),
        createdAt: snapshot.exists
          ? snapshot.data()?.createdAt || FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { jobId, claimed: true };
  });
}

export async function skipControlReminder(
  identity: ControlReminderIdentity,
  reason: "future_appointment" | "missing_channel"
): Promise<void> {
  const { jobId, ref } = referenceFor(identity);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) return;
    transaction.create(ref, {
      kind: "control_follow_up",
      idempotencyHash: jobId.replace(/^reminder_/, ""),
      targetDate: identity.targetDate,
      status: "skipped",
      skipReason: reason,
      attemptCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function completeControlReminder(params: {
  centerId: string;
  jobId: string;
  leaseOwner: string;
  outcome: "sent" | "failed";
  providerMessageId?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  const ref = db
    .collection("centers")
    .doc(params.centerId)
    .collection("reminderJobs")
    .doc(params.jobId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (
      !snapshot.exists ||
      data?.status !== "processing" ||
      data?.leaseOwner !== params.leaseOwner
    ) {
      throw new Error("REMINDER_LEASE_MISMATCH");
    }
    transaction.update(ref, {
      status: params.outcome,
      leaseOwner: null,
      leaseExpiresAt: null,
      providerMessageId:
        params.outcome === "sent" && params.providerMessageId
          ? params.providerMessageId
          : FieldValue.delete(),
      lastErrorCode:
        params.outcome === "failed" && params.errorCode ? params.errorCode : FieldValue.delete(),
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
