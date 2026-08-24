import { AgendaConfig, Doctor } from "../types";

export type AgendaResourceType = "service" | "room" | "equipment";

/**
 * Recurso operativo con agenda propia. No es una cuenta de usuario ni un
 * profesional y, por diseño, no contiene datos de identidad o acceso.
 */
export interface AgendaResource {
  id: string;
  centerId: string;
  entityType: "agenda_resource";
  resourceType: AgendaResourceType;
  displayName: string;
  description: string;
  agendaConfig: AgendaConfig;
  visibleInBooking: boolean;
  active: boolean;
  legacySourceId?: string;
}

export const isAgendaResource = (value: unknown): value is AgendaResource => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgendaResource>;
  return (
    candidate.entityType === "agenda_resource" &&
    typeof candidate.id === "string" &&
    typeof candidate.centerId === "string" &&
    typeof candidate.displayName === "string" &&
    ["service", "room", "equipment"].includes(candidate.resourceType ?? "") &&
    typeof candidate.agendaConfig?.slotDuration === "number" &&
    typeof candidate.agendaConfig?.startTime === "string" &&
    typeof candidate.agendaConfig?.endTime === "string"
  );
};

/** Proyección transitoria: nunca expone identidad, rol o capacidades legacy. */
export const adaptLegacyServiceProfile = (doctor: Doctor): AgendaResource | null => {
  if (doctor.role !== "SERVICIO") return null;
  return {
    id: doctor.id,
    centerId: doctor.centerId,
    entityType: "agenda_resource",
    resourceType: "service",
    displayName: doctor.fullName,
    description: doctor.specialty || "Servicio",
    agendaConfig: doctor.agendaConfig ?? {
      slotDuration: 15,
      startTime: "08:00",
      endTime: "18:00",
    },
    visibleInBooking: doctor.visibleInBooking !== false,
    active: doctor.active !== false,
    legacySourceId: doctor.id,
  };
};

export const mergeAgendaResources = (
  resources: AgendaResource[],
  legacyDoctors: Doctor[]
): AgendaResource[] => {
  const byId = new Map<string, AgendaResource>();
  legacyDoctors.forEach((doctor) => {
    const resource = adaptLegacyServiceProfile(doctor);
    if (resource?.active) byId.set(resource.id, resource);
  });
  resources.forEach((resource) => {
    if (resource.active) byId.set(resource.id, resource);
    else byId.delete(resource.id);
  });
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
};

export const canEntityOpenClinicalRecord = (entity: Doctor | AgendaResource): boolean =>
  !isAgendaResource(entity) && entity.role !== "SERVICIO";
