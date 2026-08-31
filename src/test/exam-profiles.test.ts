import { describe, expect, it } from "vitest";
import { EXAM_PROFILES, TRACKED_EXAMS_OPTIONS } from "../../constants";

describe("perfiles clínicos de seguimiento", () => {
  it("incluye el perfil lipídico completo", () => {
    expect(EXAM_PROFILES.find((profile) => profile.id === "p_lipidico")?.exams).toEqual([
      "colesterol_total",
      "colesterol_hdl",
      "colesterol_ldl",
      "trigliceridos",
    ]);
  });

  it("describe y agrega el perfil diabético completo", () => {
    const profile = EXAM_PROFILES.find((item) => item.id === "p_metabolico");
    expect(profile?.summary).toBe("Glic + P. lipídico + Crea + BUN + RAC + HbA1c");
    expect(profile?.exams).toEqual(
      expect.arrayContaining(["glicemia_ayunas", "creatinina", "bun", "rac", "hba1c"])
    );
  });

  it("incluye los componentes solicitados de perfiles hepático y hemograma", () => {
    expect(EXAM_PROFILES.find((profile) => profile.id === "p_hepatico")?.exams).toEqual([
      "bilirrubina_total",
      "bilirrubina_directa",
      "bilirrubina_indirecta",
      "got_ast",
      "gpt_alt",
      "ggt",
      "fosfatasa_alcalina",
    ]);
    expect(EXAM_PROFILES.find((profile) => profile.id === "p_hemograma")?.exams).toEqual([
      "hematocrito",
      "hemoglobina",
      "leucocitos",
      "plaquetas",
      "vhs",
    ]);
  });

  it("todos los componentes de perfiles existen en el catálogo editable", () => {
    const ids = new Set(TRACKED_EXAMS_OPTIONS.map((exam) => exam.id));
    EXAM_PROFILES.flatMap((profile) => profile.exams).forEach((examId) => {
      expect(ids.has(examId)).toBe(true);
    });
  });
});
