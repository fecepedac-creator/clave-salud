/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {
  LogAccessRequest,
  LogAccessResult,
  AuditLogData,
  LogAuditEventRequest,
  LogAuditEventResult,
} from "./types";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const storage = admin.storage();

const BACKUP_TOKEN = process.env.BACKUP_TOKEN || functions.config()?.backup?.token || "";
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || functions.config()?.backup?.bucket || "";
const BACKUP_PREFIX = process.env.BACKUP_PREFIX || functions.config()?.backup?.prefix || "backups/firestore";

const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const METADATA_FLAVOR_HEADER = "Metadata-Flavor";

function getProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    admin.app().options.projectId ||
    functions.config()?.backup?.projectid ||
    ""
  );
}

function getBackupPrefix() {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const month = date.slice(0, 7);
  const time = now
    .toISOString()
    .replace(/[:]/g, "-")
    .replace(/\..+/, "");
  return `${BACKUP_PREFIX}/${month}/${date}_${time}`;
}

async function getAccessToken(): Promise<string> {
  if (process.env.BACKUP_ACCESS_TOKEN) {
    return process.env.BACKUP_ACCESS_TOKEN;
  }
  const res = await fetch(METADATA_TOKEN_URL, {
    headers: { [METADATA_FLAVOR_HEADER]: "Google" },
  });
  if (!res.ok) {
    throw new Error(`Metadata token error: ${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("No access_token from metadata server.");
  }
  return data.access_token;
}

async function verifySuperAdminFromRequest(req: functions.https.Request): Promise<boolean> {
  const authHeader = req.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) return false;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return (
      decoded.super_admin === true ||
      decoded.superadmin === true ||
      decoded.superAdmin === true ||
      (Array.isArray((decoded as any).roles) &&
        (((decoded as any).roles as string[]).includes("super_admin") ||
          ((decoded as any).roles as string[]).includes("superadmin")))
    );
  } catch {
    return false;
  }
}

type StaffPublicData = {
  id: string;
  centerId: string;
  fullName: string;
  role: string;
  specialty: string;
  photoUrl: string;
  agendaConfig: Record<string, unknown> | null;
  active: boolean;
  updatedAt: admin.firestore.FieldValue;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp | null;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function resolveActive(data: Record<string, any> | undefined): boolean {
  if (!data) return true;
  if (typeof data.active === "boolean") return data.active;
  if (typeof data.activo === "boolean") return data.activo;
  return true;
}

function buildPublicStaffData(
  staffUid: string,
  centerId: string,
  staffData: Record<string, any> | undefined,
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp | null
): StaffPublicData {
  const agendaConfig =
    staffData && staffData.agendaConfig !== undefined ? staffData.agendaConfig : null;

  return {
    id: staffUid,
    centerId,
    fullName: normalizeString(
      staffData?.fullName ?? staffData?.nombre ?? staffData?.name ?? staffData?.displayName ?? ""
    ),
    role: normalizeString(staffData?.role ?? ""),
    specialty: normalizeString(staffData?.specialty ?? ""),
    photoUrl: normalizeString(staffData?.photoUrl ?? ""),
    agendaConfig,
    active: resolveActive(staffData),
    updatedAt: serverTimestamp(),
    createdAt: createdAt ?? serverTimestamp(),
  };
}

function requireAuth(context: functions.https.CallableContext) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
}

function isSuperAdmin(context: functions.https.CallableContext): boolean {
  const t: any = context.auth?.token || {};
  return (
    t.super_admin === true ||
    t.superadmin === true ||
    t.superAdmin === true ||
    (Array.isArray(t.roles) && (t.roles.includes("super_admin") || t.roles.includes("superadmin")))
  );
}

function randToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function formatChileanPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("56")) {
    return `+${digits}`;
  }
  if (digits.startsWith("9") && digits.length >= 9) {
    return `+56${digits}`;
  }
  if (digits.length === 8) {
    return `+569${digits}`;
  }
  return `+56${digits}`;
}

function lowerEmailFromContext(context: functions.https.CallableContext): string {
  const raw = (context.auth?.token as any)?.email ?? "";
  return String(raw || "").trim().toLowerCase();
}

const SUPERADMIN_WHITELIST = new Set<string>([
  "fecepedac@gmail.com",
  "dr.felipecepeda@gmail.com",
]);

/**
 * INVITE schema (Firestore: invites/{token})
 * {
 *   token: string (docId también)
 *   centerId: string
 *   centerName?: string
 *   emailLower: string
 *   role: "center_admin" | "doctor" | ...
 *   status: "pending" | "accepted" | "claimed" | "revoked"
 *   createdAt: Timestamp
 *   expiresAt: Timestamp
 *   invitedByUid?: string
 * }
 */

export const createCenterAdminInvite = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const centerId = String(data?.centerId || "").trim();
  const emailLower = String(data?.adminEmail || data?.email || "").trim().toLowerCase();
  const centerName = String(data?.centerName || "").trim();

  if (!centerId) throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  if (!emailLower) throw new functions.https.HttpsError("invalid-argument", "adminEmail/email es requerido.");

  const token = randToken(24);
  const createdAt = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.collection("invites").doc(token).set({
    token,
    centerId,
    centerName,
    emailLower,
    role: "center_admin",
    status: "pending",
    createdAt,
    expiresAt,
    invitedByUid: context.auth?.uid,
  });

  const inviteUrl = `https://clavesalud-2.web.app/invite?token=${token}`;
  return { token, inviteUrl };
});

export const setSuperAdmin = functions.https.onCall(async (data, context) => {
  requireAuth(context);

  const callerUid = context.auth!.uid;
  const callerEmail = lowerEmailFromContext(context);

  const isAllowed =
    isSuperAdmin(context) ||
    (callerEmail && SUPERADMIN_WHITELIST.has(callerEmail));

  if (!isAllowed) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para esta acción.");
  }

  const targetUidRaw = String(data?.uid || "").trim();
  const targetUid = targetUidRaw || callerUid;

  if (!isSuperAdmin(context) && targetUid !== callerUid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo puedes elevar tu propio usuario."
    );
  }

  await admin.auth().setCustomUserClaims(targetUid, { super_admin: true });

  await db.collection("auditLogs").add({
    action: "set_super_admin",
    actorUid: callerUid,
    actorEmail: callerEmail || null,
    targetUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, targetUid };
});

export const acceptInvite = functions.https.onCall(async (data, context) => {
  requireAuth(context);

  const token = String(data?.token || "").trim();
  if (!token) throw new functions.https.HttpsError("invalid-argument", "token es requerido.");

  const uid = context.auth!.uid;
  const emailLower = lowerEmailFromContext(context);
  if (!emailLower) throw new functions.https.HttpsError("failed-precondition", "Tu cuenta no tiene email disponible.");

  const invRef = db.collection("invites").doc(token);
  const invSnap = await invRef.get();
  if (!invSnap.exists) throw new functions.https.HttpsError("not-found", "Invitación no encontrada o inválida.");

  const inv: any = invSnap.data() || {};
  if (String(inv.status || "") !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", "Esta invitación ya fue utilizada o no está activa.");
  }

  const expiresAt = inv.expiresAt;
  if (expiresAt?.toDate) {
    if (expiresAt.toDate().getTime() < Date.now()) {
      throw new functions.https.HttpsError("failed-precondition", "La invitación expiró.");
    }
  }

  if (String(inv.emailLower || "").toLowerCase() !== emailLower) {
    throw new functions.https.HttpsError("permission-denied", "Este correo no coincide con el invitado.");
  }

  const centerId = String(inv.centerId || "").trim();
  if (!centerId) throw new functions.https.HttpsError("failed-precondition", "Invitación sin centerId.");

  const role = String(inv.role || "center_admin").trim() || "center_admin";
  const profileData = inv.profileData || {};

  const userRef = db.collection("users").doc(uid);
  const staffRef = db.collection("centers").doc(centerId).collection("staff").doc(uid);

  await db.runTransaction(async (tx) => {
    tx.set(
      userRef,
      {
        uid,
        email: emailLower,
        activo: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        centros: admin.firestore.FieldValue.arrayUnion(centerId),
        centers: admin.firestore.FieldValue.arrayUnion(centerId),
        roles: admin.firestore.FieldValue.arrayUnion(role),
      },
      { merge: true }
    );

    tx.set(
      staffRef,
      {
        uid,
        emailLower,
        role,
        roles: [role],
        active: true,
        activo: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteToken: token,
        // Include profile data from invite
        fullName: profileData.fullName ?? "",
        rut: profileData.rut ?? "",
        specialty: profileData.specialty ?? "",
        photoUrl: profileData.photoUrl ?? "",
        agendaConfig: profileData.agendaConfig ?? null,
        professionalRole: profileData.role ?? inv.professionalRole ?? "",
        isAdmin: profileData.isAdmin ?? false,
      },
      { merge: true }
    );

    tx.update(invRef, {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedByUid: uid,
    });
  });

  return { ok: true, centerId, role };
});

export const listPatientAppointments = functions.https.onCall(async (data) => {
  const centerId = String(data?.centerId || "").trim();
  const patientRut = String(data?.rut || "").trim();
  const phone = formatChileanPhone(String(data?.phone || ""));

  if (!centerId) throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  if (!patientRut) throw new functions.https.HttpsError("invalid-argument", "RUT es requerido.");
  if (!phone) throw new functions.https.HttpsError("invalid-argument", "Teléfono es requerido.");

  const snap = await db
    .collection("centers")
    .doc(centerId)
    .collection("appointments")
    .where("status", "==", "booked")
    .where("patientRut", "==", patientRut)
    .where("patientPhone", "==", phone)
    .limit(25)
    .get();

  const appointments = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }));
  return { appointments };
});

export const cancelPatientAppointment = functions.https.onCall(async (data) => {
  const centerId = String(data?.centerId || "").trim();
  const appointmentId = String(data?.appointmentId || "").trim();
  const patientRut = String(data?.rut || "").trim();
  const phone = formatChileanPhone(String(data?.phone || ""));

  if (!centerId) throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  if (!appointmentId) throw new functions.https.HttpsError("invalid-argument", "appointmentId es requerido.");
  if (!patientRut) throw new functions.https.HttpsError("invalid-argument", "RUT es requerido.");
  if (!phone) throw new functions.https.HttpsError("invalid-argument", "Teléfono es requerido.");

  const ref = db.collection("centers").doc(centerId).collection("appointments").doc(appointmentId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "La cita no existe.");
    }
    const data = snap.data() as any;
    if (data.status !== "booked") {
      throw new functions.https.HttpsError("failed-precondition", "La cita no está reservada.");
    }
    if (String(data.patientRut || "") !== patientRut || String(data.patientPhone || "") !== phone) {
      throw new functions.https.HttpsError("permission-denied", "Los datos no coinciden.");
    }

    tx.update(ref, {
      status: "available",
      patientName: "",
      patientRut: "",
      patientPhone: "",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

export const syncPublicStaff = functions.firestore
  .document("centers/{centerId}/staff/{staffUid}")
  .onWrite(async (change, context) => {
    const centerId = String(context.params.centerId || "").trim();
    const staffUid = String(context.params.staffUid || "").trim();

    if (!centerId || !staffUid) {
      functions.logger.warn("syncPublicStaff missing params", { centerId, staffUid });
      return;
    }

    const publicRef = db
      .collection("centers")
      .doc(centerId)
      .collection("publicStaff")
      .doc(staffUid);

    if (!change.after.exists) {
      await publicRef.delete();
      functions.logger.info("syncPublicStaff deleted public staff", { centerId, staffUid });
      return;
    }

    const staffData = change.after.data() as Record<string, any> | undefined;
    const publicSnap = await publicRef.get();
    const existingCreatedAt = publicSnap.exists ? (publicSnap.get("createdAt") as any) : null;

    const publicData = buildPublicStaffData(staffUid, centerId, staffData, existingCreatedAt);
    await publicRef.set(publicData, { merge: true });

    functions.logger.info("syncPublicStaff upserted public staff", {
      centerId,
      staffUid,
      active: publicData.active,
    });
  });

export const backfillPublicStaff = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const requestedCenterId = String(data?.centerId || "").trim();
  const centersRef = db.collection("centers");
  let centersDocs: admin.firestore.DocumentSnapshot[];

  if (requestedCenterId) {
    const centerSnap = await centersRef.doc(requestedCenterId).get();
    centersDocs = centerSnap.exists ? [centerSnap] : [];
  } else {
    const centersSnap = await centersRef.get();
    centersDocs = centersSnap.docs;
  }

  let centersProcessed = 0;
  let staffProcessed = 0;
  let failures = 0;

  for (const centerDoc of centersDocs) {
    const centerId = centerDoc.id;
    const centerData = centerDoc.data() as Record<string, any> | undefined;
    if (!requestedCenterId && centerData?.isActive === false) {
      continue;
    }

    centersProcessed += 1;
    const staffSnap = await centersRef.doc(centerId).collection("staff").get();

    for (const staffDoc of staffSnap.docs) {
      const staffUid = staffDoc.id;
      const staffData = staffDoc.data() as Record<string, any> | undefined;
      const publicRef = centersRef.doc(centerId).collection("publicStaff").doc(staffUid);

      try {
        const publicSnap = await publicRef.get();
        const existingCreatedAt = publicSnap.exists ? (publicSnap.get("createdAt") as any) : null;
        const publicData = buildPublicStaffData(staffUid, centerId, staffData, existingCreatedAt);
        await publicRef.set(publicData, { merge: true });
        staffProcessed += 1;
      } catch (error) {
        failures += 1;
        functions.logger.error("backfillPublicStaff failed", {
          centerId,
          staffUid,
          error: String(error),
        });
      }
    }
  }

  functions.logger.info("backfillPublicStaff completed", {
    centersProcessed,
    staffProcessed,
    failures,
  });

  return { ok: true, centersProcessed, staffProcessed, failures };
});

/**
 * logAccess - Cloud Function para registrar accesos a datos clínicos
 * 
 * Implementa trazabilidad de accesos conforme al DS 41 MINSAL con:
 * - Deduplicación: un acceso por recurso/usuario cada 60 segundos
 * - Solo accesible por staff o superadmins autenticados
 * - Timestamps del servidor para integridad
 */
export const logAccess = functions.https.onCall(async (data: LogAccessRequest, context): Promise<LogAccessResult> => {
  requireAuth(context);
  
  const uid = context.auth!.uid;
  const emailLower = lowerEmailFromContext(context);
  
  // Validar campos requeridos
  const centerId = String(data?.centerId || "").trim();
  const resourceType = String(data?.resourceType || "").trim();
  const resourcePath = String(data?.resourcePath || "").trim();
  
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  }
  if (!resourceType) {
    throw new functions.https.HttpsError("invalid-argument", "resourceType es requerido.");
  }
  if (!resourcePath) {
    throw new functions.https.HttpsError("invalid-argument", "resourcePath es requerido.");
  }
  
  // Validar que el resourceType sea válido
  const validResourceTypes = ["patient", "consultation", "appointment"];
  if (!validResourceTypes.includes(resourceType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `resourceType debe ser uno de: ${validResourceTypes.join(", ")}`
    );
  }
  
  // Verificar permisos: debe ser staff del centro o superadmin
  const staffRef = db.collection("centers").doc(centerId).collection("staff").doc(uid);
  const staffSnap = await staffRef.get();
  
  const isStaffMember = staffSnap.exists && (
    staffSnap.get("active") === true || 
    staffSnap.get("activo") === true
  );
  
  if (!isSuperAdmin(context) && !isStaffMember) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tiene permisos para acceder a este centro."
    );
  }
  
  // Obtener rol del usuario
  const staffData = staffSnap.data() as any;
  const role = staffData?.role || "unknown";
  const actorName =
    staffData?.fullName ||
    staffData?.nombre ||
    context.auth?.token?.name ||
    context.auth?.token?.email ||
    "Usuario";
  
  // Deduplicación: crear un ID basado en usuario + recurso
  const dedupeKey = `${uid}_${resourcePath}`;
  const dedupeDocRef = db
    .collection("centers")
    .doc(centerId)
    .collection("auditLogs")
    .doc(`dedupe_${dedupeKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
  
  try {
    // Usar transacción para verificar deduplicación atómica
    const result = await db.runTransaction(async (transaction) => {
      const dedupeSnap = await transaction.get(dedupeDocRef);
      
      // Si existe un log reciente (menos de 60 segundos), no crear uno nuevo
      if (dedupeSnap.exists) {
        const lastTimestamp = dedupeSnap.get("timestamp");
        if (lastTimestamp?.toMillis) {
          const timeSinceLastLog = Date.now() - lastTimestamp.toMillis();
          if (timeSinceLastLog < 60000) { // 60 segundos
            functions.logger.info("logAccess deduplicated", {
              centerId,
              uid,
              resourcePath,
              timeSinceLastLog,
            });
            return { logged: false };
          }
        }
      }
      
      // Crear el log de auditoría
      const auditLogRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
      
      const resourceSegments = resourcePath.split("/").filter(Boolean);
      const entityId = resourceSegments[resourceSegments.length - 1] || "";
      const auditLogData: AuditLogData = {
        type: "ACCESS",
        action: "ACCESS",
        entityType: resourceType as any,
        entityId,
        actorUid: uid,
        actorEmail: emailLower,
        actorName,
        actorRole: role,
        resourceType: resourceType as any,
        resourcePath,
        timestamp: serverTimestamp(),
      };
      
      // Añadir campos opcionales si están presentes
      if (data.patientId) {
        auditLogData.patientId = String(data.patientId).trim();
      }
      if (data.ip) {
        auditLogData.ip = String(data.ip).trim();
      }
      if (data.userAgent) {
        auditLogData.userAgent = String(data.userAgent).trim();
      }
      
      // Escribir el log y actualizar el documento de deduplicación
      transaction.set(auditLogRef, auditLogData);
      transaction.set(dedupeDocRef, {
        timestamp: serverTimestamp(),
        resourcePath,
        actorUid: uid,
      }, { merge: true });
      
      functions.logger.info("logAccess created", {
        centerId,
        uid,
        role,
        resourceType,
        resourcePath,
      });
      
      return { logged: true };
    });
    
    return {
      ok: true,
      logged: result.logged,
      message: result.logged ? "Acceso registrado." : "Acceso ya registrado recientemente.",
    };
  } catch (error) {
    functions.logger.error("logAccess error", {
      centerId,
      uid,
      resourcePath,
      error: String(error),
    });
    throw new functions.https.HttpsError(
      "internal",
      "Error al registrar el acceso."
    );
  }
});

export const logAuditEvent = functions.https.onCall(
  async (data: LogAuditEventRequest, context): Promise<LogAuditEventResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario no autenticado.");
    }

    const centerId = String(data?.centerId || "").trim();
    const action = String(data?.action || "").trim();
    const entityType = String(data?.entityType || "").trim();
    const entityId = String(data?.entityId || "").trim();

    if (!centerId || !action || !entityType || !entityId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "centerId, action, entityType y entityId son requeridos."
      );
    }

    const validEntityTypes = ["patient", "consultation", "appointment", "document", "centerSettings"];
    if (!validEntityTypes.includes(entityType)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `entityType debe ser uno de: ${validEntityTypes.join(", ")}`
      );
    }

    const uid = context.auth.uid;
    const emailLower = lowerEmailFromContext(context);

    const staffRef = db.collection("centers").doc(centerId).collection("staff").doc(uid);
    const staffSnap = await staffRef.get();
    const isStaffMember =
      staffSnap.exists &&
      (staffSnap.get("active") === true || staffSnap.get("activo") === true);

    if (!isSuperAdmin(context) && !isStaffMember) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tiene permisos para registrar auditoría en este centro."
      );
    }

    const staffData = staffSnap.data() as any;
    const actorRole = staffData?.role || "unknown";
    const actorName =
      staffData?.fullName ||
      staffData?.nombre ||
      context.auth?.token?.name ||
      context.auth?.token?.email ||
      "Usuario";

    const auditLogRef = db.collection("centers").doc(centerId).collection("auditLogs").doc();
    const isClinicalEntity = ["patient", "consultation", "appointment"].includes(entityType);
    const resourceType = isClinicalEntity ? (entityType as any) : "patient";
    const resourcePath = isClinicalEntity
      ? `/centers/${centerId}/${entityType}s/${entityId}`
      : `/centers/${centerId}`;
    const auditLogData: AuditLogData = {
      type: "ACTION",
      action,
      entityType: entityType as any,
      entityId,
      actorUid: uid,
      actorEmail: emailLower,
      actorName,
      actorRole,
      resourceType,
      resourcePath,
      timestamp: serverTimestamp(),
    };

    if (data.patientId) {
      auditLogData.patientId = String(data.patientId).trim();
    }
    if (typeof data.details === "string" && data.details.trim()) {
      auditLogData.details = data.details.trim();
    }
    if (data.metadata && typeof data.metadata === "object") {
      auditLogData.metadata = data.metadata;
    }

    await auditLogRef.set(auditLogData);

    functions.logger.info("logAuditEvent created", {
      centerId,
      uid,
      action,
      entityType,
      entityId,
    });

    return { ok: true, logged: true, message: "Evento registrado." };
  }
);

/**
 * runMonthlyBackup - Ejecuta export de Firestore a GCS.
 * Diseñada para Cloud Scheduler (token) y ejecución manual por super_admin.
 */
export const runMonthlyBackup = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const headerToken = String(req.get("X-Backup-Token") || "").trim();
  const schedulerAuthorized = Boolean(BACKUP_TOKEN && headerToken && headerToken === BACKUP_TOKEN);
  const superAdminAuthorized = await verifySuperAdminFromRequest(req);

  if (!schedulerAuthorized && !superAdminAuthorized) {
    res.status(403).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const projectId = getProjectId();
  if (!projectId) {
    res.status(500).json({ ok: false, error: "Missing projectId" });
    return;
  }
  if (!BACKUP_BUCKET) {
    res.status(500).json({ ok: false, error: "Missing BACKUP_BUCKET" });
    return;
  }

  const payload = typeof req.body === "object" ? req.body : {};
  const dryRun = Boolean(payload?.dryRun);
  const prefix = getBackupPrefix();
  const outputUriPrefix = `gs://${BACKUP_BUCKET}/${prefix}`;

  const manifest = {
    timestamp: new Date().toISOString(),
    projectId,
    function: "runMonthlyBackup",
    type: "export/firestore-admin",
    outputUriPrefix,
    reason: payload?.reason || "MANUAL",
    initiatedBy: payload?.initiatedBy || (schedulerAuthorized ? "cloud-scheduler" : "super_admin"),
  };

  if (dryRun) {
    await storage.bucket(BACKUP_BUCKET).file(`${prefix}/manifest.json`).save(
      JSON.stringify({ ...manifest, dryRun: true }, null, 2),
      { contentType: "application/json" }
    );
    res.status(200).json({ ok: true, dryRun: true, outputUriPrefix });
    return;
  }

  try {
    const accessToken = await getAccessToken();
    const exportRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outputUriPrefix,
        }),
      }
    );

    if (!exportRes.ok) {
      const errorText = await exportRes.text();
      functions.logger.error("runMonthlyBackup export failed", {
        status: exportRes.status,
        error: errorText,
      });
      res.status(500).json({ ok: false, error: "Export failed" });
      return;
    }

    const exportBody = await exportRes.json();
    await storage.bucket(BACKUP_BUCKET).file(`${prefix}/manifest.json`).save(
      JSON.stringify({ ...manifest, export: exportBody }, null, 2),
      { contentType: "application/json" }
    );

    functions.logger.info("runMonthlyBackup export started", {
      projectId,
      outputUriPrefix,
    });

    res.status(200).json({ ok: true, outputUriPrefix, export: exportBody });
  } catch (error) {
    functions.logger.error("runMonthlyBackup error", { error: String(error) });
    res.status(500).json({ ok: false, error: "Backup failed" });
  }
});
