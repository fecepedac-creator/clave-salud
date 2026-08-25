import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ensureAuditLogResult } from "../../hooks/useAuditLog";

describe("required audit gate", () => {
  it("allows a sensitive action only after confirmed persistence", () => {
    expect(ensureAuditLogResult({ ok: true, logged: true })).toEqual({
      ok: true,
      logged: true,
    });
  });

  it("fails closed on missing, rejected or partial results", () => {
    expect(() => ensureAuditLogResult(undefined)).toThrow("AUDIT_REQUIRED");
    expect(() => ensureAuditLogResult({ ok: false, logged: false })).toThrow("AUDIT_REQUIRED");
    expect(() => ensureAuditLogResult({ ok: true, logged: false })).toThrow("AUDIT_REQUIRED");
  });

  it("uses the fail-closed gate on every clinical print or export surface", () => {
    [
      "components/PrintPreviewModal.tsx",
      "components/ClinicalReportModal.tsx",
      "components/FullClinicalRecordPrintView.tsx",
    ].forEach((path) => {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("logAuditEventRequired");
      expect(source).not.toContain("logAuditEventSafe");
    });
  });
});
