import {
  canReadSuperAdminOperationalMetrics,
  toSuperAdminOperationalMetrics,
} from "../superAdminOperationalMetrics";

describe("super admin operational metrics authorization", () => {
  it("accepts only canonical super-admin claims", () => {
    expect(canReadSuperAdminOperationalMetrics({ super_admin: true })).toBe(true);
    expect(canReadSuperAdminOperationalMetrics({ roles: ["super_admin"] })).toBe(true);
    expect(canReadSuperAdminOperationalMetrics({ superadmin: true })).toBe(true);
  });

  it("rejects administrative, support and malformed claims", () => {
    expect(canReadSuperAdminOperationalMetrics({ roles: ["center_admin"] })).toBe(false);
    expect(canReadSuperAdminOperationalMetrics({ roles: ["support"] })).toBe(false);
    expect(canReadSuperAdminOperationalMetrics({ super_admin: "true" })).toBe(false);
    expect(canReadSuperAdminOperationalMetrics({})).toBe(false);
  });

  it("returns an aggregate-only projection", () => {
    expect(toSuperAdminOperationalMetrics(120, 8, "2026-08-23T12:00:00.000Z")).toEqual({
      patients: 120,
      professionals: 8,
      generatedAt: "2026-08-23T12:00:00.000Z",
    });
    expect(Object.keys(toSuperAdminOperationalMetrics(120, 8, "2026-08-23T12:00:00.000Z"))).toEqual(
      ["patients", "professionals", "generatedAt"]
    );
  });
});
