import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";

/**
 * Hook para registrar accesos a datos clínicos (DS 41 MINSAL)
 * 
 * Uso:
 * const { logAccess, loading, error } = useAuditLog();
 * 
 * await logAccess({
 *   centerId: "centro123",
 *   resourceType: "patient",
 *   resourcePath: "centers/centro123/patients/patient456",
 *   patientId: "patient456"
 * });
 */

export type AuditLogResourceType = "patient" | "consultation" | "appointment";

export interface LogAccessRequest {
  centerId: string;
  resourceType: AuditLogResourceType;
  resourcePath: string;
  patientId?: string;
  actorUid?: string;
  ip?: string;
  userAgent?: string;
}

export interface LogAccessResult {
  ok: boolean;
  logged: boolean;
  message?: string;
}

export interface LogAuditEventRequest {
  centerId: string;
  action: string;
  entityType: string;
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

export function useAuditLog() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logAccess = async (request: LogAccessRequest): Promise<LogAccessResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const logAccessFn = httpsCallable<LogAccessRequest, LogAccessResult>(functions, "logAccess");
      
      const result = await logAccessFn(request);
      
      setLoading(false);
      return result.data;
    } catch (err: any) {
      console.error("Error logging access:", err);
      setError(err.message || "Error al registrar el acceso");
      setLoading(false);
      return null;
    }
  };

  return { logAccess, loading, error };
}

export async function logAccessSafe(
  logAccessFn: (request: LogAccessRequest) => Promise<LogAccessResult | null>,
  request: LogAccessRequest
) {
  try {
    await logAccessFn(request);
  } catch (error) {
    console.error("Failed to log access:", error);
  }
}

export async function logAuditEventSafe(request: LogAuditEventRequest) {
  try {
    const functions = getFunctions();
    const logAuditEventFn = httpsCallable<LogAuditEventRequest, LogAuditEventResult>(
      functions,
      "logAuditEvent"
    );
    await logAuditEventFn(request);
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
