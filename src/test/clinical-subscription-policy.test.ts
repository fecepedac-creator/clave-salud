import { describe, expect, it } from "vitest";
import { canSubscribeToClinicalPatients } from "../../utils/clinicalSubscriptionPolicy";

describe("clinical patient subscription policy", () => {
  it("lets a clinician with a global-admin claim reach the Rules gate", () => {
    expect(canSubscribeToClinicalPatients("clinical-admin-uid", true)).toBe(true);
  });

  it("requires authentication for an ordinary scoped user", () => {
    expect(canSubscribeToClinicalPatients(undefined, false)).toBe(false);
    expect(canSubscribeToClinicalPatients("professional-uid", false)).toBe(true);
  });
});
