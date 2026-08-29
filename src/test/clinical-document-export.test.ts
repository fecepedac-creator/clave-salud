import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import {
  createFullClinicalRecordWordBlob,
  downloadClinicalReportWord,
} from "../../utils/clinicalDocumentExport";
import type { Consultation, MedicalCenter, Patient } from "../../types";

const patient: Patient = {
  id: "patient-docx-test",
  centerId: "center-test",
  rut: "15.678.432-1",
  fullName: "María Elena Soto Ramírez",
  birthDate: "1967-09-22",
  gender: "Femenino",
  smokingStatus: "No fumador",
  alcoholStatus: "No consumo",
  medicalHistory: ["HTA", "DM2"],
  surgicalHistory: [],
  medications: [],
  allergies: [],
  consultations: [],
  attachments: [],
  active: true,
  lastUpdated: "2026-08-22T12:00:00.000Z",
};

describe("clinical document Word export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a real docx download with a descriptive filename", async () => {
    const createObjectURL = vi.fn(() => "blob:clinical-report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    let downloadedFilename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      downloadedFilename = this.download;
    });

    await downloadClinicalReportWord({
      patient,
      centerName: "Centro Médico de Prueba",
      professional: {
        name: "Dr. Profesional Demo",
        role: "Médico",
        rut: "16.459.999-1",
      },
      objective: "Evaluación clínica de prueba",
      dateRange: "2025-08-12 a 2026-07-21",
      content: "1. Antecedentes\nPaciente en control.\n\n2. Conclusión\nSeguimiento indicado.",
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(downloadedFilename).toBe("informe-clinico-maria-elena-soto-ramirez-editable.docx");
  });

  it("creates a complete editable clinical record with compact metadata", async () => {
    const center: MedicalCenter = {
      id: "center-test",
      slug: "center-test",
      name: "Centro Médico Los Andes (Test)",
      primaryColor: "emerald",
      createdAt: "2025-01-01",
      isActive: true,
      maxUsers: 10,
      allowedRoles: ["MEDICO"],
      modules: { dental: true, prescriptions: true, agenda: true },
    };
    const consultation: Consultation = {
      id: "consultation-test",
      date: "2026-08-17T14:30:00.000Z",
      reason: "Control de hipertensión arterial y diabetes mellitus tipo 2.",
      anamnesis:
        "Paciente refiere buena adherencia al tratamiento y niega síntomas cardiovasculares.",
      physicalExam: "Paciente en buenas condiciones generales, hidratado y afebril.",
      diagnosis: "Hipertensión arterial controlada. Diabetes mellitus tipo 2.",
      bloodPressure: "128/78",
      heartRate: "72",
      weight: "74",
      height: "168",
      bmi: "26.2",
      prescriptions: [],
      professionalName: "Felipe Cepeda Cea",
      professionalId: "doctor-test",
      professionalRole: "MEDICO",
      professionalRut: "16.459.999-1",
      active: true,
    };

    const blob = await createFullClinicalRecordWordBlob({
      patient,
      center,
      consultations: [
        consultation,
        { ...consultation, id: "consultation-test-2", date: "2026-07-10" },
      ],
      generatedAt: "2026-08-17T15:21:51.000Z",
      generatedBy: { name: "Felipe Cepeda Cea", role: "Médico Cirujano", rut: "16.459.999-1" },
    });

    expect(blob.size).toBeGreaterThan(10_000);
    if (process.env.CLINICAL_DOCX_QA_PATH) {
      await writeFile(process.env.CLINICAL_DOCX_QA_PATH, Buffer.from(await blob.arrayBuffer()));
    }
  });
});
