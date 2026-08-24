export type AgendaConflictMode = "block" | "require_override";

export interface AgendaPolicy {
  centerId: string;
  locationId: string;
  slotDurationMinutes: number;
  requirePatientContact: boolean;
  allowPublicCancellation: boolean;
  cancellationWindowHours: number;
  allowInternalOutsideHours: boolean;
  appointmentConflictMode: AgendaConflictMode;
  resourceConflictMode: AgendaConflictMode;
  revision: number;
}

export const DEFAULT_AGENDA_POLICY: Omit<AgendaPolicy, "centerId" | "locationId"> = {
  slotDurationMinutes: 30,
  requirePatientContact: true,
  allowPublicCancellation: true,
  cancellationWindowHours: 24,
  allowInternalOutsideHours: false,
  appointmentConflictMode: "block",
  resourceConflictMode: "block",
  revision: 1,
};

const boundedInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export function normalizeAgendaPolicy(
  centerId: string,
  locationId: string,
  value: Partial<AgendaPolicy> | null | undefined
): AgendaPolicy {
  const conflictMode = (candidate: unknown): AgendaConflictMode =>
    candidate === "require_override" ? "require_override" : "block";

  return {
    centerId,
    locationId,
    slotDurationMinutes: boundedInteger(value?.slotDurationMinutes, 30, 5, 240),
    requirePatientContact: value?.requirePatientContact !== false,
    allowPublicCancellation: value?.allowPublicCancellation !== false,
    cancellationWindowHours: boundedInteger(value?.cancellationWindowHours, 24, 0, 720),
    allowInternalOutsideHours: value?.allowInternalOutsideHours === true,
    appointmentConflictMode: conflictMode(value?.appointmentConflictMode),
    resourceConflictMode: conflictMode(value?.resourceConflictMode),
    revision: boundedInteger(value?.revision, 1, 1, Number.MAX_SAFE_INTEGER),
  };
}

export function canApplyAgendaOverride(input: {
  conflictMode: AgendaConflictMode;
  hasOverrideCapability: boolean;
  reason?: string;
}): boolean {
  return (
    input.conflictMode === "require_override" &&
    input.hasOverrideCapability &&
    Boolean(input.reason?.trim())
  );
}
