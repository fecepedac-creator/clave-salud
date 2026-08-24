import { Appointment } from "../types";

export type CalendarConflictPolicy = "manual_review" | "local_wins" | "external_busy_blocks";

export interface ExternalCalendarEventPayload {
  localAppointmentId: string;
  title: "Agenda ocupada";
  start: { date: string; time: string; timeZone: string };
  durationMinutes: number;
  availability: "busy";
  visibility: "private";
  status: "confirmed" | "cancelled";
}

export interface CalendarConflictInput {
  localStatus: "available" | "booked" | "cancelled";
  externalStatus: "free" | "busy" | "cancelled";
  linkedToSameAppointment: boolean;
  localChanged: boolean;
  externalChanged: boolean;
}

export type CalendarConflictResolution =
  | "no_change"
  | "upsert_external"
  | "cancel_external"
  | "block_local"
  | "manual_review";

/**
 * Único payload permitido hacia un calendario externo. No acepta ni proyecta
 * identidad, contacto o contenido clínico del paciente.
 */
export const toExternalCalendarPayload = (
  appointment: Appointment,
  options: { durationMinutes: number; timeZone: string }
): ExternalCalendarEventPayload => {
  if (
    !appointment.id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointment.date || "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointment.time || "")
  ) {
    throw new Error("INVALID_APPOINTMENT_TIME");
  }
  if (
    !Number.isInteger(options.durationMinutes) ||
    options.durationMinutes < 5 ||
    options.durationMinutes > 24 * 60
  ) {
    throw new Error("INVALID_APPOINTMENT_DURATION");
  }
  if (!/^[A-Za-z_]+\/[A-Za-z_+-]+$/.test(options.timeZone.trim())) {
    throw new Error("INVALID_TIME_ZONE");
  }

  return {
    localAppointmentId: appointment.id,
    title: "Agenda ocupada",
    start: {
      date: appointment.date,
      time: appointment.time,
      timeZone: options.timeZone,
    },
    durationMinutes: options.durationMinutes,
    availability: "busy",
    visibility: "private",
    status:
      appointment.status === "cancelled" || appointment.attendanceStatus === "cancelled"
        ? "cancelled"
        : "confirmed",
  };
};

export const resolveCalendarConflict = (
  input: CalendarConflictInput,
  policy: CalendarConflictPolicy = "manual_review"
): CalendarConflictResolution => {
  if (!input.localChanged && !input.externalChanged) return "no_change";

  if (input.linkedToSameAppointment) {
    if (input.localStatus === "cancelled") return "cancel_external";
    if (input.localChanged && !input.externalChanged) return "upsert_external";
    if (!input.localChanged && input.externalStatus === "cancelled") return "manual_review";
  }

  if (policy === "local_wins") {
    return input.localStatus === "cancelled" ? "cancel_external" : "upsert_external";
  }

  if (policy === "external_busy_blocks") {
    if (input.externalStatus === "busy" && input.localStatus === "available") return "block_local";
    if (input.externalStatus === "busy" && input.localStatus === "booked") return "manual_review";
    if (input.localStatus === "cancelled") return "cancel_external";
    return input.localChanged ? "upsert_external" : "no_change";
  }

  return "manual_review";
};

export interface CalendarSyncConfiguration {
  enabled: boolean;
  oauthConfigured: boolean;
  timeZone: string;
  conflictPolicy?: CalendarConflictPolicy;
}

export class ExternalCalendarSyncDisabledError extends Error {
  readonly code = "CALENDAR_SYNC_DISABLED";

  constructor() {
    super("La sincronización de calendario está deshabilitada hasta configurar OAuth.");
    this.name = "ExternalCalendarSyncDisabledError";
  }
}

/** Prepara solicitudes; deliberadamente no recibe credenciales ni realiza red. */
export class ExternalCalendarSyncService {
  constructor(private readonly configuration: CalendarSyncConfiguration) {}

  prepareEvent(appointment: Appointment, durationMinutes: number): ExternalCalendarEventPayload {
    this.assertEnabled();
    return toExternalCalendarPayload(appointment, {
      durationMinutes,
      timeZone: this.configuration.timeZone,
    });
  }

  resolveConflict(input: CalendarConflictInput): CalendarConflictResolution {
    this.assertEnabled();
    return resolveCalendarConflict(input, this.configuration.conflictPolicy || "manual_review");
  }

  private assertEnabled(): void {
    if (!this.configuration.enabled || !this.configuration.oauthConfigured) {
      throw new ExternalCalendarSyncDisabledError();
    }
  }
}
