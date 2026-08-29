import { describe, expect, it } from "vitest";
import { getHistoryCode, getHistoryDisplay } from "../../features/doctor/utils/patientHistory";

describe("legacy patient history normalization", () => {
  it("returns safe strings when a structured history entry has missing fields", () => {
    expect(getHistoryDisplay({ code: "legacy-code" })).toBe("");
    expect(getHistoryCode({ display: "Antecedente legado" })).toBe("");
  });

  it("tolerates null legacy entries", () => {
    expect(getHistoryDisplay(null)).toBe("");
    expect(getHistoryCode(undefined)).toBe("");
  });
});
