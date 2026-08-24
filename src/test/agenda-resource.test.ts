import { describe, expect, it } from "vitest";
import {
  adaptLegacyServiceProfile,
  canEntityOpenClinicalRecord,
  mergeAgendaResources,
  type AgendaResource,
} from "../../domain/agendaResource";
import type { Doctor } from "../../types";

const legacy: Doctor = {
  id: "legacy-lab",
  centerId: "center-a",
  rut: "SERVICIO",
  fullName: "Laboratorio",
  email: "lab@example.test",
  specialty: "Toma de muestras",
  role: "SERVICIO",
  accessRole: "professional",
  clinicalRole: "MEDICO",
  capabilities: ["clinical_record.read"],
};

const resource: AgendaResource = {
  id: "legacy-lab",
  centerId: "center-a",
  entityType: "agenda_resource",
  resourceType: "room",
  displayName: "Sala de procedimientos",
  description: "Sala 1",
  agendaConfig: { slotDuration: 30, startTime: "09:00", endTime: "17:00" },
  visibleInBooking: false,
  active: true,
};

describe("AgendaResource", () => {
  it("adapta un servicio legacy sin proyectar identidad ni permisos", () => {
    const adapted = adaptLegacyServiceProfile(legacy);
    expect(adapted).toMatchObject({ id: "legacy-lab", entityType: "agenda_resource" });
    expect(adapted).not.toHaveProperty("rut");
    expect(adapted).not.toHaveProperty("email");
    expect(adapted).not.toHaveProperty("role");
    expect(adapted).not.toHaveProperty("capabilities");
  });

  it("niega acceso clínico a recursos nuevos y servicios legacy", () => {
    expect(canEntityOpenClinicalRecord(resource)).toBe(false);
    expect(canEntityOpenClinicalRecord(legacy)).toBe(false);
  });

  it("conserva el acceso clínico de un profesional real", () => {
    expect(canEntityOpenClinicalRecord({ ...legacy, id: "doctor", role: "MEDICO" })).toBe(true);
  });

  it("prioriza la entidad nueva sobre la proyección legacy", () => {
    expect(mergeAgendaResources([resource], [legacy])).toEqual([resource]);
  });
});
