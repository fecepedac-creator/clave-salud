import {
  sanitizeStaffCapabilities,
  sanitizeStaffMembershipProfile,
} from "../staffCapabilityPolicy";

describe("staff capability policy", () => {
  it("rejects clinical capabilities injected into an administrator invite", () => {
    expect(
      sanitizeStaffMembershipProfile("center_admin", {
        clinicalRole: "MEDICO",
        capabilities: ["users.manage", "clinical_record.read", "clinical_record.sign"],
      })
    ).toEqual({
      accessRole: "center_admin",
      clinicalRole: "",
      capabilities: ["users.manage"],
      visibleInBooking: false,
      isAdmin: true,
    });
  });

  it("preserves all supported professional profiles", () => {
    expect(
      sanitizeStaffMembershipProfile("professional", {
        clinicalRole: "KINESIOLOGO",
        visibleInBooking: true,
      })
    ).toMatchObject({
      accessRole: "professional",
      clinicalRole: "KINESIOLOGO",
      visibleInBooking: true,
    });
    expect(
      sanitizeStaffMembershipProfile("professional", { clinicalRole: "PSICOLOGO" })
    ).toMatchObject({ clinicalRole: "PSICOLOGO" });
  });

  it("treats explicit empty capabilities as deny all", () => {
    expect(
      sanitizeStaffMembershipProfile("professional", {
        clinicalRole: "MEDICO",
        capabilities: [],
      }).capabilities
    ).toEqual([]);
  });

  it("never grants signature to TENS by default or explicit manipulation", () => {
    expect(
      sanitizeStaffMembershipProfile("professional", { clinicalRole: "TENS" }).capabilities
    ).not.toContain("clinical_record.sign");
    expect(
      sanitizeStaffMembershipProfile("professional", {
        clinicalRole: "TENS",
        capabilities: ["clinical_record.sign", "clinical_record.read"],
      }).capabilities
    ).toEqual(["clinical_record.read"]);
  });

  it("maps legacy operational capability names", () => {
    expect(
      sanitizeStaffCapabilities("administrative", ["appointment.contact", "appointment.check_in"])
    ).toEqual(["agenda.contact", "agenda.check_in"]);
  });
});
