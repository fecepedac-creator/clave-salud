import { computeAuditChainHash, serializeAuditChainPayload } from "../immutableAudit";

describe("immutable audit chain", () => {
  test("builds deterministic hash for the same payload", () => {
    const payload = serializeAuditChainPayload({
      logId: "log_1",
      chainScope: "center:center_1",
      chainIndex: 1,
      prevHash: "",
      signedAt: "2026-03-30T18:00:00.000Z",
      entry: {
        type: "ACTION",
        action: "PATIENT_UPDATE",
        entityType: "patient",
        entityId: "patient_1",
      },
    });

    expect(computeAuditChainHash(payload)).toBe(computeAuditChainHash(payload));
  });

  test("changes the hash when the previous hash changes", () => {
    const base = {
      logId: "log_2",
      chainScope: "center:center_1",
      chainIndex: 2,
      signedAt: "2026-03-30T18:01:00.000Z",
      entry: {
        type: "ACCESS",
        action: "ACCESS",
        entityType: "patient",
        entityId: "patient_1",
      },
    };

    const payloadA = serializeAuditChainPayload({
      ...base,
      prevHash: "aaa",
    });
    const payloadB = serializeAuditChainPayload({
      ...base,
      prevHash: "bbb",
    });

    expect(computeAuditChainHash(payloadA)).not.toBe(computeAuditChainHash(payloadB));
  });
});
