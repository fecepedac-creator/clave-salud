import { describe, expect, it } from "vitest";
import { canSubscribeToClinicalPatients } from "../../utils/clinicalSubscriptionPolicy";

describe("clinical patient subscription policy", () => {
  it("never opens a clinical patient subscription for global superadmin", () => {
    expect(canSubscribeToClinicalPatients("super-uid", true)).toBe(false);
  });

  it("requires authentication for an ordinary scoped user", () => {
    expect(canSubscribeToClinicalPatients(undefined, false)).toBe(false);
    expect(canSubscribeToClinicalPatients("professional-uid", false)).toBe(true);
  });
});
