export type InviteStatus = "pending" | "claimed" | "revoked";

export interface InviteDoc {
  emailLower: string;
  email?: string;
  centerId: string;
  role: string; // guardamos raw; el cliente normaliza si quiere
  status: InviteStatus;

  createdAt?: any;
  createdByUid?: string;

  expiresAt?: any;

  claimedAt?: any;
  claimedByUid?: string;

  professionalId?: string;
}

export interface ClaimInviteResult {
  ok: true;
  centerId: string;
  role: string;
}

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

export interface LogAccessRequest {
  centerId: string;
  resourceType: AuditLogResourceType;
  resourcePath: string;
  patientId?: string;
  ip?: string;
  userAgent?: string;
}

export interface LogAccessResult {
  ok: boolean;
  logged: boolean; // false if deduplicated
  message?: string;
}

export interface LogAuditEventRequest {
  centerId: string;
  action: string;
  entityType: AuditLogResourceType | "document" | "centerSettings";
  entityId: string;
  patientId?: string;
  details?: string;
  metadata?: Record<string, any>;
}

export interface LogAuditEventResult {
  ok: boolean;
  logged: boolean;
  message?: string;
}
