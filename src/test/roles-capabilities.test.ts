import { describe, expect, it } from "vitest";
import { ROLE_CATALOG } from "../../constants";
import {
  adaptLegacyAccess,
  getDefaultCapabilities,
  isCreatableCenterStaffRole,
  normalizeClinicalProfession,
  sanitizeCapabilitiesForAccessRole,
} from "../../utils/roles";

describe("canonical roles and capabilities", () => {
  it("recognizes every clinical profession offered by the center catalog", () => {
    const clinicalRoles = ROLE_CATALOG.map((item) => item.id).filter(isCreatableCenterStaffRole);
    expect(clinicalRoles).toContain("KINESIOLOGO");
    expect(clinicalRoles).toContain("PSICOLOGO");
    expect(clinicalRoles).toContain("QUIMICO_FARMACEUTICO");
    expect(clinicalRoles).not.toContain("SERVICIO");
    expect(
      clinicalRoles
        .filter((role) => !["ADMIN_CENTRO", "ADMINISTRATIVO"].includes(role))
        .every((role) => normalizeClinicalProfession(role) !== null)
    ).toBe(true);
  });

  it("does not derive clinical access from an administrator profession", () => {
    const profile = adaptLegacyAccess({ accessRole: "center_admin", clinicalRole: "MEDICO" });
    expect(profile.accessRole).toBe("center_admin");
    expect(profile.clinicalProfession).toBe("MEDICO");
    expect(profile.capabilities).not.toContain("clinical_record.read");
    expect(profile.capabilities).not.toContain("clinical_record.sign");
  });

  it("gives superadministrators no default clinical or audit access", () => {
    expect(getDefaultCapabilities("super_admin")).toEqual([]);
  });

  it("keeps professional defaults clinical while excluding TENS signature", () => {
    expect(getDefaultCapabilities("professional", "MEDICO")).toContain("clinical_record.sign");
    expect(getDefaultCapabilities("professional", "TENS")).not.toContain("clinical_record.sign");
  });

  it("treats an explicit empty list as deny all", () => {
    expect(
      adaptLegacyAccess({
        accessRole: "professional",
        clinicalRole: "KINESIOLOGO",
        capabilities: [],
      }).capabilities
    ).toEqual([]);
  });

  it("discards unknown or cross-role capabilities and adapts legacy aliases", () => {
    expect(
      sanitizeCapabilitiesForAccessRole("administrative", [
        "appointment.contact",
        "clinical_record.read",
        "unknown.capability",
      ])
    ).toEqual(["agenda.contact"]);
    expect(
      sanitizeCapabilitiesForAccessRole("center_admin", ["clinical_record.read", "users.manage"])
    ).toEqual(["users.manage"]);
  });
});
