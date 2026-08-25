import { Timestamp } from "firebase-admin/firestore";
import { isValidActiveSupportSession } from "../supportAccess";

describe("support diagnostic session policy", () => {
  const now = Date.parse("2026-08-23T12:00:00.000Z");

  it("accepts only the assigned actor, diagnostic permission and future expiry", () => {
    expect(
      isValidActiveSupportSession(
        {
          status: "active",
          granteeUid: "support-a",
          permissions: ["support.diagnostics"],
          expiresAt: Timestamp.fromMillis(now + 60_000),
        },
        "support-a",
        now
      )
    ).toBe(true);
  });

  it("denies expired, revoked, unassigned or broader-looking sessions", () => {
    const base = {
      status: "active",
      granteeUid: "support-a",
      permissions: ["support.diagnostics"],
      expiresAt: Timestamp.fromMillis(now + 60_000),
    };
    expect(isValidActiveSupportSession(base, "support-b", now)).toBe(false);
    expect(isValidActiveSupportSession({ ...base, status: "revoked" }, "support-a", now)).toBe(
      false
    );
    expect(
      isValidActiveSupportSession(
        { ...base, permissions: ["clinical_record.read"] },
        "support-a",
        now
      )
    ).toBe(false);
    expect(
      isValidActiveSupportSession(
        { ...base, expiresAt: Timestamp.fromMillis(now) },
        "support-a",
        now
      )
    ).toBe(false);
  });
});
