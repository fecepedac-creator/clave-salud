import { generateId, sanitizeForFirestore } from "../utils";

export interface ClinicalVersionRecordInput {
  entityType: "patient" | "consultation";
  entityId: string;
  patientId: string;
  centerId?: string;
  version: number;
  actorUid?: string;
  actorName?: string;
  summary: string;
  snapshot: Record<string, any>;
  diff?: Record<string, any>;
}

export const buildClinicalVersionRecord = (input: ClinicalVersionRecordInput) =>
  sanitizeForFirestore({
    id: generateId(),
    entityType: input.entityType,
    entityId: input.entityId,
    patientId: input.patientId,
    centerId: input.centerId || null,
    version: input.version,
    actorUid: input.actorUid || null,
    actorName: input.actorName || null,
    summary: input.summary,
    snapshot: input.snapshot,
    diff: input.diff || null,
    createdAt: new Date().toISOString(),
  });
