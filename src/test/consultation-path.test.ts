import { describe, expect, it } from "vitest";
import { consultationCollectionPath } from "../../features/doctor/utils/consultationPath";

describe("consultationCollectionPath", () => {
  it("listens to the canonical patient consultation subcollection", () => {
    expect(consultationCollectionPath("center-a", "patient-a", "clinical")).toEqual([
      "patients",
      "patient-a",
      "consultations",
    ]);
  });

  it("keeps the legacy centre path only for operational directory entries", () => {
    expect(consultationCollectionPath("center-a", "patient-a", "operational")).toEqual([
      "centers",
      "center-a",
      "patients",
      "patient-a",
      "consultations",
    ]);
  });
});
