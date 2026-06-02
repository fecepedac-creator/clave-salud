import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  auditPrescription,
  cleanStr,
  findControlledDrugMatches,
  getDrugSuggestions,
  getPosologyTemplate,
  hasControlledDrug,
  VademecumItem,
} from "../../utils/vademecum";
import { useConsultationLogic } from "../../hooks/doctor/useConsultationLogic";
import { Patient } from "../../types";

const mockCreatePatientConsultation = vi
  .fn()
  .mockResolvedValue({ data: { ok: true, id: "mock_doc_id" } });

// Mock toast component to prevent provider errors
vi.mock("../../components/Toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock our own firebase module
vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test_doctor_uid" } },
  functions: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => mockCreatePatientConsultation),
}));

describe("Vademecum Suggestions Search", () => {
  it("should return matches for paracetamol", () => {
    const results = getDrugSuggestions("paracetamol");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].activePrinciple.toLowerCase()).toBe("paracetamol");
  });

  it("should match with or without accents (losartán vs losartan)", () => {
    const resultsAcc = getDrugSuggestions("losartán");
    const resultsNoAcc = getDrugSuggestions("losartan");
    expect(resultsAcc.length).toBeGreaterThan(0);
    expect(resultsNoAcc.length).toBeGreaterThan(0);
    expect(cleanStr(resultsAcc[0].activePrinciple)).toContain("losartan");
    expect(cleanStr(resultsNoAcc[0].activePrinciple)).toContain("losartan");
  });

  it("should correct fuzzy typos like dapaglifozina and parecetamol", () => {
    const dapResults = getDrugSuggestions("dapaglifozina");
    const parResults = getDrugSuggestions("parecetamol");
    expect(dapResults.length).toBeGreaterThan(0);
    expect(dapResults[0].activePrinciple.toLowerCase()).toBe("dapagliflozina");
    expect(parResults.length).toBeGreaterThan(0);
    expect(parResults[0].activePrinciple.toLowerCase()).toBe("paracetamol");
  });

  it("should handle multi-token queries such as valsartan amlodipino", () => {
    const results = getDrugSuggestions("valsartan amlodipino");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].activePrinciple.toLowerCase()).toContain("valsartán");
    expect(results[0].activePrinciple.toLowerCase()).toContain("amlodipino");
  });
});

describe("Posology Templates", () => {
  it("should map comprimidos to tablet template", () => {
    const item: VademecumItem = {
      id: "test",
      activePrinciple: "Metformina",
      brandName: "Glafornil",
      presentation: "Glafornil 850 mg comprimidos",
      strength: "850 mg",
      form: "comprimido",
      route: "Oral",
      prescriptionRequired: true,
      controlled: false,
      source: "local",
      lastUpdated: "2026-05-25",
    };
    const template = getPosologyTemplate(item);
    expect(template).toBe(": Tomar ___ comprimido(s) cada ___ horas por ___ días.");
  });

  it("should map gotas to drops template", () => {
    const item: VademecumItem = {
      id: "test",
      activePrinciple: "Tramadol",
      brandName: "Genérico",
      presentation: "Tramadol Gotas",
      strength: "100 mg/ml",
      form: "gotas",
      route: "Oral",
      prescriptionRequired: true,
      controlled: true,
      source: "local",
      lastUpdated: "2026-05-25",
    };
    const template = getPosologyTemplate(item);
    expect(template).toBe(": Tomar ___ gota(s) cada ___ horas por ___ días.");
  });

  it("should map solution inyectable to ampoule template", () => {
    const item: VademecumItem = {
      id: "test",
      activePrinciple: "Semaglutida",
      brandName: "Ozempic",
      presentation: "Ozempic solución inyectable",
      strength: "1 mg",
      form: "solución inyectable",
      route: "Inyectable",
      prescriptionRequired: true,
      controlled: false,
      source: "local",
      lastUpdated: "2026-05-25",
    };
    const template = getPosologyTemplate(item);
    expect(template).toBe(": Administrar ___ por vía ___ cada ___ horas/días por ___ días.");
  });
});

describe("Clinical Alerts Auditor", () => {
  const patient: Patient = {
    id: "pat_1",
    active: true,
    centerId: "center_1",
    fullName: "Juan Perez",
    rut: "12345678-9",
    birthDate: "1980-01-01",
    gender: "Masculino",
    allergies: [
      { id: "al_1", type: "Farmaco", substance: "penicilina", reaction: "rash" },
      { id: "al_2", type: "Otro", substance: "AINEs", reaction: "gastritis" },
    ],
    medicalHistory: ["Enfermedad Renal Crónica"],
    surgicalHistory: [],
    smokingStatus: "No fumador",
    alcoholStatus: "No consumo",
    medications: [],
    consultations: [],
    attachments: [],
    email: "juan@perez.cl",
    phone: "+56912345678",
    createdAt: "",
    lastUpdated: "",
  };

  it("should trigger allergy alerts for penicilina/amoxicilina", () => {
    const alerts = auditPrescription("Amoxicilina 500 mg: Tomar 1 cada 8 horas", patient);
    expect(alerts.some((a) => a.type === "allergy" && a.severity === "error")).toBe(true);
  });

  it("should trigger allergy alerts for AINEs/ibuprofen", () => {
    const alerts = auditPrescription("Ibuprofeno 400 mg: Tomar 1 cada 8 horas", patient);
    expect(alerts.some((a) => a.type === "allergy" && a.severity === "error")).toBe(true);
  });

  it("should trigger sildenafil + nitratos critical alert", () => {
    const alerts = auditPrescription("Sildenafil 50 mg\nNitroglicerina parches", patient);
    expect(alerts.some((a) => a.type === "interaction" && a.severity === "error")).toBe(true);
  });

  it("should trigger therapeutic duplication alert for same active principle twice", () => {
    const alerts = auditPrescription("Metformina 850 mg\nGlafornil 1000 mg", patient);
    expect(alerts.some((a) => a.type === "duplication" && a.severity === "error")).toBe(true);
  });

  it("should trigger therapeutic duplication alert for two AINEs", () => {
    const alerts = auditPrescription("Ibuprofeno 400 mg\nNaproxeno 550 mg", patient);
    expect(alerts.some((a) => a.type === "duplication" && a.severity === "warning")).toBe(true);
  });

  it("should detect controlled drugs and require Receta Retenida", () => {
    expect(hasControlledDrug("Clonazepam 2 mg comprimidos")).toBe(true);
    expect(findControlledDrugMatches("Ravotril 0.5 mg").length).toBeGreaterThan(0);

    const standardAlerts = auditPrescription(
      "Clonazepam 2 mg comprimidos",
      patient,
      "",
      "Receta Médica"
    );
    expect(
      standardAlerts.some(
        (a) => a.title === "Tipo de Receta Incompatible" && a.severity === "error"
      )
    ).toBe(true);

    const retainedAlerts = auditPrescription(
      "Clonazepam 2 mg comprimidos",
      patient,
      "",
      "Receta Retenida"
    );
    expect(
      retainedAlerts.some((a) => a.title === "Medicamento Controlado" && a.severity === "warning")
    ).toBe(true);
  });
});

describe("Role Validation in useConsultationLogic", () => {
  const mockPatient: Patient = {
    id: "pat_1",
    active: true,
    centerId: "center_1",
    fullName: "Juan Perez",
    rut: "12345678-9",
    birthDate: "1980-01-01",
    gender: "Masculino",
    allergies: [],
    medicalHistory: [],
    surgicalHistory: [],
    smokingStatus: "No fumador",
    alcoholStatus: "No consumo",
    medications: [],
    consultations: [],
    attachments: [],
    email: "juan@perez.cl",
    phone: "",
    createdAt: "",
    lastUpdated: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should block non-prescribing role (e.g. Secretary/Kinesiologist) from saving consultations with prescriptions", async () => {
    const onUpdatePatient = vi.fn();
    const onLogActivity = vi.fn();
    const setActiveTab = vi.fn();

    const { result } = renderHook(() =>
      useConsultationLogic({
        selectedPatient: mockPatient,
        setSelectedPatient: vi.fn(),
        activeCenterId: "center_1",
        hasActiveCenter: true,
        doctorId: "doc_123",
        doctorName: "Dr. Test",
        role: "KINESIOLOGO" as any,
        onUpdatePatient,
        onLogActivity,
        setActiveTab,
      })
    );

    // Add a prescription
    act(() => {
      result.current.addPrescription({
        id: "presc_1",
        type: "Receta Médica",
        content: "Paracetamol 500 mg",
      });
    });

    await result.current.handleCreateConsultation();

    expect(mockCreatePatientConsultation).not.toHaveBeenCalled();
    expect(onUpdatePatient).not.toHaveBeenCalled();
  });

  it("should block Matrona from saving controlled drugs (Receta Retenida)", async () => {
    const onUpdatePatient = vi.fn();
    const onLogActivity = vi.fn();
    const setActiveTab = vi.fn();

    const { result } = renderHook(() =>
      useConsultationLogic({
        selectedPatient: mockPatient,
        setSelectedPatient: vi.fn(),
        activeCenterId: "center_1",
        hasActiveCenter: true,
        doctorId: "doc_123",
        doctorName: "Dr. Test",
        role: "MATRONA" as any,
        onUpdatePatient,
        onLogActivity,
        setActiveTab,
      })
    );

    // Add a controlled prescription
    act(() => {
      result.current.addPrescription({
        id: "presc_1",
        type: "Receta Retenida",
        content: "Clonazepam 2 mg",
      });
    });

    await result.current.handleCreateConsultation();

    expect(mockCreatePatientConsultation).not.toHaveBeenCalled();
    expect(onUpdatePatient).not.toHaveBeenCalled();
  });

  it("should block controlled drug content outside Receta Retenida", async () => {
    const onUpdatePatient = vi.fn();
    const onLogActivity = vi.fn();
    const setActiveTab = vi.fn();

    const { result } = renderHook(() =>
      useConsultationLogic({
        selectedPatient: mockPatient,
        setSelectedPatient: vi.fn(),
        activeCenterId: "center_1",
        hasActiveCenter: true,
        doctorId: "doc_123",
        doctorName: "Dr. Test",
        role: "MEDICO" as any,
        onUpdatePatient,
        onLogActivity,
        setActiveTab,
      })
    );

    act(() => {
      result.current.addPrescription({
        id: "presc_1",
        type: "Receta Médica",
        content: "Clonazepam 2 mg comprimidos",
      });
    });

    await result.current.handleCreateConsultation();

    expect(mockCreatePatientConsultation).not.toHaveBeenCalled();
    expect(onUpdatePatient).not.toHaveBeenCalled();
  });

  it("should allow Medico to save standard and controlled prescriptions", async () => {
    const onUpdatePatient = vi.fn();
    const onLogActivity = vi.fn();
    const setActiveTab = vi.fn();

    const { result } = renderHook(() =>
      useConsultationLogic({
        selectedPatient: mockPatient,
        setSelectedPatient: vi.fn(),
        activeCenterId: "center_1",
        hasActiveCenter: true,
        doctorId: "doc_123",
        doctorName: "Dr. Test",
        role: "MEDICO" as any,
        onUpdatePatient,
        onLogActivity,
        setActiveTab,
      })
    );

    act(() => {
      result.current.addPrescription({
        id: "presc_1",
        type: "Receta Retenida",
        content: "Clonazepam 2 mg",
      });
    });

    await result.current.handleCreateConsultation();

    expect(mockCreatePatientConsultation).toHaveBeenCalled();
    expect(onUpdatePatient).toHaveBeenCalled();
  });
});
