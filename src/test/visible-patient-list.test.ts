import { describe, expect, it } from "vitest";
import { RECENT_PATIENTS_LIMIT, visiblePatientList } from "../../features/doctor/utils/visiblePatientList";

describe("visible patient list", () => {
  const patients = Array.from({ length: 20 }, (_, index) => `patient-${index + 1}`);

  it("shows only the recent-list limit before searching", () => {
    expect(visiblePatientList(patients, "")).toEqual(patients.slice(0, RECENT_PATIENTS_LIMIT));
    expect(visiblePatientList(patients, "   ")).toEqual(patients.slice(0, RECENT_PATIENTS_LIMIT));
  });

  it("keeps every matching result visible while searching", () => {
    expect(visiblePatientList(patients, "ana")).toEqual(patients);
  });
});
