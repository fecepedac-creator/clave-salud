// Types de invitación eliminados por no ser requeridos

// Audit Logs Types
export type AuditLogResourceType = "patient" | "consultation" | "appointment";

export interface AuditLogData {
  type: "ACCESS" | "ACTION";
  action?: string;
  entityType?: AuditLogResourceType | "document" | "centerSettings";
  entityId?: string;
  actorUid: string;
  actorEmail: string;
  actorName?: string;
  actorRole: string;
  patientId?: string;
  resourceType: AuditLogResourceType;
  resourcePath: string;
  timestamp: any; // ServerTimestamp
  ip?: string;
  userAgent?: string;
  details?: string;
  metadata?: Record<string, any>;
}

// Types de peticiones de logs eliminados
