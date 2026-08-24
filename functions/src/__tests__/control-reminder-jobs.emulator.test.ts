import { db } from "../firebaseAdmin";
import { claimControlReminder, completeControlReminder } from "../controlReminderJobs";

jest.setTimeout(30_000);

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator("control reminder jobs", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const centerId = `reminder-center-${suffix}`;
  const identity = {
    centerId,
    patientId: `patient-${suffix}`,
    consultationId: "consultation-1",
    targetDate: "2026-08-30",
  };

  afterAll(async () => {
    await db.recursiveDelete(db.collection("centers").doc(centerId));
  });

  it("grants one concurrent lease and persists one terminal send", async () => {
    const [first, second] = await Promise.all([
      claimControlReminder(identity, "run-a", 1_000),
      claimControlReminder(identity, "run-b", 1_000),
    ]);
    const winner = first.claimed
      ? { result: first, owner: "run-a" }
      : { result: second, owner: "run-b" };
    const loser = first.claimed ? second : first;
    expect(winner.result.claimed).toBe(true);
    expect(loser).toMatchObject({ claimed: false, reason: "active_lease" });

    await completeControlReminder({
      centerId,
      jobId: winner.result.jobId,
      leaseOwner: winner.owner,
      outcome: "sent",
      providerMessageId: "wamid.synthetic",
    });
    const retry = await claimControlReminder(identity, "run-c", 2_000);
    expect(retry).toMatchObject({ claimed: false, reason: "terminal" });

    const snapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("reminderJobs")
      .doc(winner.result.jobId)
      .get();
    expect(snapshot.data()).toMatchObject({
      status: "sent",
      attemptCount: 1,
      providerMessageId: "wamid.synthetic",
    });
    expect(JSON.stringify(snapshot.data())).not.toMatch(/patient-|consultation-1/);
  });
});
