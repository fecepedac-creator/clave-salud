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

const functionsConfig = (functions as any).config?.() ?? {};
const BACKUP_TOKEN = process.env.BACKUP_TOKEN || functionsConfig?.backup?.token || "";
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || functionsConfig?.backup?.bucket || "";
const BACKUP_PREFIX = process.env.BACKUP_PREFIX || functionsConfig?.backup?.prefix || "backups/firestore";

const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const METADATA_FLAVOR_HEADER = "Metadata-Flavor";

function getProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    admin.app().options.projectId ||
    functionsConfig?.backup?.projectid ||
    ""
  );
}

type CallableContext = {
  auth?: {
    uid?: string;
    token?: Record<string, any>;
  } | null;
};

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
  accessRole: string;
  clinicalRole: string;
  role: string;
  specialty: string;
  photoUrl: string;
  visibleInBooking: boolean;
  agendaConfig: Record<string, unknown> | null;
  active: boolean;
  updatedAt: admin.firestore.FieldValue;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp | null;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function normalizeAccessRole(data: Record<string, any> | undefined): string {
  const accessRole = normalizeString(data?.accessRole ?? "").trim();
  if (accessRole) return accessRole;
  const role = normalizeString(data?.role ?? "").trim();
  if (role === "center_admin" || role === "doctor" || role === "admin") return role;
  if (data?.isAdmin === true) return "center_admin";
  return "doctor";
}

function normalizeClinicalRole(data: Record<string, any> | undefined): string {
  const explicit = normalizeString(data?.clinicalRole ?? data?.professionalRole ?? "").trim();
  if (explicit) return explicit;
  const legacyRole = normalizeString(data?.role ?? "").trim();
  if (!legacyRole) return "";
  if (legacyRole.toLowerCase() === "center_admin") return "";
  if (["doctor", "admin"].includes(legacyRole.toLowerCase())) return "";
  return legacyRole;
}

function resolveVisibleInBooking(data: Record<string, any> | undefined): boolean {
  if (!data) return false;
  return data.visibleInBooking === true;
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

  const fullName = normalizeString(
    staffData?.fullName ?? staffData?.displayName ?? staffData?.nombre ?? staffData?.name ?? ""
  );
  const accessRole = normalizeAccessRole(staffData);
  const clinicalRole = normalizeClinicalRole(staffData);

  return {
    id: staffUid,
    centerId,
    fullName,
    accessRole,
    clinicalRole,
    role: clinicalRole,
    specialty: normalizeString(staffData?.specialty ?? ""),
    photoUrl: normalizeString(staffData?.photoUrl ?? ""),
    visibleInBooking: resolveVisibleInBooking(staffData),
    agendaConfig,
    active: resolveActive(staffData),
    updatedAt: serverTimestamp(),
    createdAt: createdAt ?? serverTimestamp(),
  };
}

function requireAuth(context: CallableContext) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
}

function isSuperAdmin(context: CallableContext): boolean {
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

function lowerEmailFromContext(context: CallableContext): string {
  const raw = (context.auth?.token as any)?.email ?? "";
  return String(raw || "").trim().toLowerCase();
}

type PosterFormat = "feed" | "story" | "whatsapp" | "internal";

const CLAVESALUD_WORDMARK = "ClaveSalud";

const posterDimensions: Record<PosterFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  whatsapp: { width: 1080, height: 1080 },
  internal: { width: 1920, height: 1080 },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line.trim());
  return lines.length ? lines : [value];
}

function buildPosterSvg(params: {
  centerName: string;
  message: string;
  format: PosterFormat;
  centerLogoUrl?: string;
}) {
  const { width, height } = posterDimensions[params.format];
  const messageLines = wrapText(params.message, params.format === "story" ? 24 : 32).slice(0, 3);
  const centerLogoUrl = params.centerLogoUrl || "";
  const background = "#f8fafc";
  const accent = "#1e293b";
  const secondary = "#475569";
  const headerHeight = Math.round(height * 0.18);
  const footerHeight = Math.round(height * 0.12);
  const contentStart = headerHeight + 40;
  const lineHeight = Math.round(height * 0.055);
  const messageStart = contentStart + lineHeight;

  const logoImage = centerLogoUrl
    ? `<image href="${escapeXml(centerLogoUrl)}" x="60" y="40" width="${Math.round(
        width * 0.35
      )}" height="${Math.round(headerHeight * 0.6)}" preserveAspectRatio="xMidYMid meet" />`
    : "";

  const messageText = messageLines
    .map(
      (line, idx) =>
        `<text x="60" y="${messageStart + idx * lineHeight}" font-size="${Math.round(
          height * 0.05
        )}" font-family="Arial, sans-serif" fill="${accent}" font-weight="700">${escapeXml(
          line
        )}</text>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${background}" />
  <rect width="100%" height="${headerHeight}" fill="#ffffff" />
  ${logoImage}
  <text x="60" y="${headerHeight - 30}" font-size="${Math.round(
    height * 0.02
  )}" font-family="Arial, sans-serif" fill="${secondary}">
    ${escapeXml(params.centerName)}
  </text>
  ${messageText}
  <rect y="${height - footerHeight}" width="100%" height="${footerHeight}" fill="#ffffff" />
  <text x="60" y="${height - Math.round(footerHeight / 2)}" font-size="${Math.round(
    height * 0.025
  )}" font-family="Arial, sans-serif" fill="${secondary}">
    Powered by ${CLAVESALUD_WORDMARK}
  </text>
</svg>`;
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

export const createCenterAdminInvite = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
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
  }
);

export const resendCenterAdminInvite = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const token = String(data?.token || "").trim();
  if (!token) throw new functions.https.HttpsError("invalid-argument", "token es requerido.");

  const inviteRef = db.collection("invites").doc(token);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Invitación no encontrada.");
  }

  const inv = inviteSnap.data() as any;
  if (String(inv.status || "") !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", "Invitación no está pendiente.");
  }

  await inviteRef.set(
    {
      status: "revoked",
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedByUid: context.auth?.uid ?? null,
    },
    { merge: true }
  );

  const newToken = randToken(24);
  const createdAt = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.collection("invites").doc(newToken).set({
    token: newToken,
    centerId: inv.centerId,
    centerName: inv.centerName || "",
    emailLower: inv.emailLower,
    role: inv.role || "center_admin",
    status: "pending",
    createdAt,
    expiresAt,
    invitedByUid: context.auth?.uid,
  });

  const inviteUrl = `https://clavesalud-2.web.app/invite?token=${newToken}`;
  return { token: newToken, inviteUrl };
  }
);

export const revokeCenterInvite = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const token = String(data?.token || "").trim();
  if (!token) throw new functions.https.HttpsError("invalid-argument", "token es requerido.");

  const inviteRef = db.collection("invites").doc(token);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Invitación no encontrada.");
  }

  await inviteRef.set(
    {
      status: "revoked",
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedByUid: context.auth?.uid ?? null,
    },
    { merge: true }
  );

  return { ok: true, token };
  }
);

export const createCenterNotification = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const centerId = String(data?.centerId || "").trim();
  const title = String(data?.title || "").trim();
  const body = String(data?.body || "").trim();
  const type = String(data?.type || "info").trim();
  const severity = String(data?.severity || "medium").trim();

  if (!centerId || !title || !body) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "centerId, title y body son requeridos."
    );
  }

  const notifRef = db
    .collection("centers")
    .doc(centerId)
    .collection("adminNotifications")
    .doc();

  await notifRef.set({
    centerId,
    title,
    body,
    type,
    severity,
    sendEmail: Boolean(data?.sendEmail),
    createdAt: serverTimestamp(),
    createdByUid: context.auth?.uid ?? null,
  });

  await db.collection("centers").doc(centerId).collection("auditLogs").add({
    type: "ACTION",
    action: "SUPERADMIN_NOTIFICATION",
    entityType: "centerSettings",
    entityId: centerId,
    actorUid: context.auth?.uid ?? "unknown",
    actorEmail: lowerEmailFromContext(context) || "unknown",
    actorName: context.auth?.token?.name || context.auth?.token?.email || "Superadmin",
    actorRole: "super_admin",
    resourceType: "patient",
    resourcePath: `/centers/${centerId}`,
    timestamp: serverTimestamp(),
    details: title,
  });

  return { ok: true };
  }
);

export const upsertCenter = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const centerId = String(data?.id || data?.centerId || "").trim();
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  }

  const name = String(data?.name || "").trim();
  const slug = String(data?.slug || "").trim();
  if (!name || !slug) {
    throw new functions.https.HttpsError("invalid-argument", "name y slug son requeridos.");
  }

  const centerRef = db.collection("centers").doc(centerId);
  const existingSnap = await centerRef.get();
  const existingData = existingSnap.exists ? (existingSnap.data() as any) : {};
  const auditReason = String(data?.auditReason || "").trim();

  const payload = { ...(data || {}) };
  delete (payload as any).createdAt;
  delete (payload as any).auditReason;
  payload.id = centerId;
  payload.name = name;
  payload.slug = slug;
  payload.updatedAt = serverTimestamp();

  if (!existingSnap.exists) {
    payload.createdAt = data?.createdAt ?? serverTimestamp();
  }

  await centerRef.set(payload, { merge: true });

  const billingPrev = existingData?.billing || {};
  const billingNext = (payload as any)?.billing || {};
  const billingChanges: Record<string, any> = {};
  ["plan", "monthlyUF", "billingStatus", "nextDueDate", "lastPaidAt"].forEach((key) => {
    if (billingPrev?.[key] !== billingNext?.[key]) {
      billingChanges[key] = { from: billingPrev?.[key] ?? null, to: billingNext?.[key] ?? null };
    }
  });

  const isActivePrev = existingData?.isActive;
  const isActiveNext = (payload as any)?.isActive;
  const isActiveChanged = isActivePrev !== isActiveNext;

  if (Object.keys(billingChanges).length > 0) {
    await centerRef.collection("billingEvents").add({
      action: "billing_update",
      reason: auditReason || null,
      changes: billingChanges,
      actorUid: context.auth?.uid ?? null,
      actorEmail: lowerEmailFromContext(context) || null,
      createdAt: serverTimestamp(),
    });
  }

  if (isActiveChanged) {
    await centerRef.collection("auditLogs").add({
      type: "ACTION",
      action: "CENTER_STATUS_CHANGED",
      entityType: "centerSettings",
      entityId: centerId,
      actorUid: context.auth?.uid ?? "unknown",
      actorEmail: lowerEmailFromContext(context) || "unknown",
      actorName: context.auth?.token?.name || context.auth?.token?.email || "Superadmin",
      actorRole: "super_admin",
      resourceType: "patient",
      resourcePath: `/centers/${centerId}`,
      timestamp: serverTimestamp(),
      details: auditReason || null,
      metadata: { from: isActivePrev ?? null, to: isActiveNext ?? null },
    });
  }

  return { ok: true, centerId };
  }
);

export const deleteCenter = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const centerId = String(data?.centerId || data?.id || "").trim();
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  }

  const reason = String(data?.reason || "").trim();
  await db.collection("auditLogs").add({
    action: "delete_center",
    actorUid: context.auth?.uid ?? "unknown",
    actorEmail: lowerEmailFromContext(context) || null,
    targetUid: centerId,
    reason: reason || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("centers").doc(centerId).delete();

  return { ok: true, centerId };
  }
);

export const setSuperAdmin = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);

  const callerUid = context.auth?.uid as string;
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

  const targetUser = await admin.auth().getUser(targetUid);
  const existingClaims = (targetUser.customClaims || {}) as Record<string, unknown>;
  await admin.auth().setCustomUserClaims(targetUid, {
    ...existingClaims,
    super_admin: true,
  });

  await db.collection("auditLogs").add({
    action: "set_super_admin",
    actorUid: callerUid,
    actorEmail: callerEmail || null,
    targetUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, targetUid };
  }
);

export const acceptInvite = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);

  const token = String(data?.token || "").trim();
  if (!token) throw new functions.https.HttpsError("invalid-argument", "token es requerido.");

  const uid = context.auth?.uid as string;
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
        accessRole: role,
        roles: [role],
        clinicalRole: profileData.clinicalRole ?? profileData.role ?? inv.professionalRole ?? "",
        active: true,
        activo: true,
        visibleInBooking: profileData.visibleInBooking === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteToken: token,
        // Include profile data from invite
        fullName: profileData.fullName ?? "",
        rut: profileData.rut ?? "",
        specialty: profileData.specialty ?? "",
        photoUrl: profileData.photoUrl ?? "",
        agendaConfig: profileData.agendaConfig ?? null,
        professionalRole: profileData.clinicalRole ?? profileData.role ?? inv.professionalRole ?? "",
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
  }
);

export const listPatientAppointments = (functions.https.onCall as any)(
  async (data: any, _context: CallableContext) => {
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
  }
);

export const cancelPatientAppointment = (functions.https.onCall as any)(
  async (data: any, _context: CallableContext) => {
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
  }
);

export const syncPublicStaff = (functions.firestore as any)
  .document("centers/{centerId}/staff/{staffUid}")
  .onWrite(async (change: any, context: any) => {
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
      await publicRef.set(
        {
          active: false,
          visibleInBooking: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      functions.logger.info("syncPublicStaff soft-disabled missing staff", { centerId, staffUid });
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

export const backfillPublicStaffFromStaff = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
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
  let staffUpdated = 0;
  let staffSkipped = 0;
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
        const currentStaff = staffData || {};
        const staffPatch: Record<string, unknown> = {};

        if (typeof currentStaff.visibleInBooking !== "boolean") {
          staffPatch.visibleInBooking = false;
        }

        const currentClinicalRole = normalizeString(currentStaff.clinicalRole ?? currentStaff.professionalRole ?? "").trim();
        if (!currentClinicalRole) {
          const legacyRole = normalizeString(currentStaff.role ?? "").trim();
          if (legacyRole && legacyRole.toLowerCase() !== "center_admin" && !["doctor", "admin"].includes(legacyRole.toLowerCase())) {
            staffPatch.clinicalRole = legacyRole;
          }
        }

        const fullName = normalizeString(currentStaff.fullName ?? "").trim();
        if (!fullName) {
          const fallbackName = normalizeString(currentStaff.displayName ?? currentStaff.name ?? "").trim();
          if (fallbackName) {
            staffPatch.fullName = fallbackName;
          }
        }

        if (Object.keys(staffPatch).length > 0) {
          await centersRef.doc(centerId).collection("staff").doc(staffUid).set(
            {
              ...staffPatch,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          staffUpdated += 1;
        } else {
          staffSkipped += 1;
        }

        const publicSnap = await publicRef.get();
        const existingCreatedAt = publicSnap.exists ? (publicSnap.get("createdAt") as any) : null;
        const mergedStaffData = { ...currentStaff, ...staffPatch };
        const publicData = buildPublicStaffData(staffUid, centerId, mergedStaffData, existingCreatedAt);
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

  functions.logger.info("backfillPublicStaffFromStaff completed", {
    centersProcessed,
    staffProcessed,
    staffUpdated,
    staffSkipped,
    failures,
  });

  return { ok: true, centersProcessed, staffProcessed, staffUpdated, staffSkipped, failures };
  }
);

export const backfillPatientConsultationsToSubcollection = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const centerId = String(data?.centerId || "").trim();
  const patientId = String(data?.patientId || "").trim();

  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  }

  const patientsRef = db.collection("centers").doc(centerId).collection("patients");
  const patientsDocs = patientId
    ? [await patientsRef.doc(patientId).get()].filter((docSnap) => docSnap.exists)
    : (await patientsRef.get()).docs;

  let patientsProcessed = 0;
  let consultationsProcessed = 0;
  let consultationsSkipped = 0;

  for (const patientDoc of patientsDocs) {
    patientsProcessed += 1;
    const pData = patientDoc.data() as Record<string, any>;
    const legacyConsultations = Array.isArray(pData?.consultations) ? pData.consultations : [];

    for (const legacy of legacyConsultations) {
      const consultationId = String(legacy?.id || "").trim();
      if (!consultationId) {
        consultationsSkipped += 1;
        continue;
      }

      await db
        .collection("centers")
        .doc(centerId)
        .collection("patients")
        .doc(patientDoc.id)
        .collection("consultations")
        .doc(consultationId)
        .set(
          {
            ...legacy,
            id: consultationId,
            centerId,
            patientId: patientDoc.id,
            updatedAt: serverTimestamp(),
            createdAt: legacy?.createdAt ?? serverTimestamp(),
          },
          { merge: true }
        );

      consultationsProcessed += 1;
    }
  }

  functions.logger.info("backfillPatientConsultationsToSubcollection completed", {
    centerId,
    patientId: patientId || null,
    patientsProcessed,
    consultationsProcessed,
    consultationsSkipped,
  });

  return { ok: true, centerId, patientsProcessed, consultationsProcessed, consultationsSkipped };
  }
);

/**
 * logAccess - Cloud Function para registrar accesos a datos clínicos
 * 
 * Implementa trazabilidad de accesos conforme al DS 41 MINSAL con:
 * - Deduplicación: un acceso por recurso/usuario cada 60 segundos
 * - Solo accesible por staff o superadmins autenticados
 * - Timestamps del servidor para integridad
 */
export const logAccess = (functions.https.onCall as any)(
  async (data: LogAccessRequest, context: CallableContext): Promise<LogAccessResult> => {
  requireAuth(context);
  
  const uid = context.auth?.uid as string;
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
  }
);

export const logAuditEvent = (functions.https.onCall as any)(
  async (data: LogAuditEventRequest, context: CallableContext): Promise<LogAuditEventResult> => {
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

    const uid = context.auth.uid as string;
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

export const generateMarketingPoster = functions.https.onCall(
  async (data: any, context: CallableContext) => {
    requireAuth(context);
    const centerId = String(data?.centerId || "").trim();
    const format = String(data?.format || "").trim() as PosterFormat;
    const message = String(data?.message || "").trim();

    if (!centerId) {
      throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
    }
    if (!message) {
      throw new functions.https.HttpsError("invalid-argument", "message es requerido.");
    }
    if (!posterDimensions[format]) {
      throw new functions.https.HttpsError("invalid-argument", "format inválido.");
    }

    const staffRef = db.doc(`centers/${centerId}/staff/${context.auth?.uid}`);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists || staffSnap.data()?.role !== "center_admin") {
      throw new functions.https.HttpsError("permission-denied", "PERMISSION_DENIED");
    }

    const marketingRef = db.doc(`centers/${centerId}/settings/marketing`);
    const marketingSnap = await marketingRef.get();
    const marketing = (marketingSnap.data() || {}) as any;
    const marketingEnabled = Boolean(marketing.enabled);
    const monthlyPosterLimit = Number(marketing.monthlyPosterLimit ?? 0);
    const allowPosterRetention = Boolean(marketing.allowPosterRetention);
    const retentionEnabled = Boolean(marketing.retentionEnabled);
    const retentionDays = Number(marketing.posterRetentionDays ?? 7);

    if (!marketingEnabled || monthlyPosterLimit === 0) {
      throw new functions.https.HttpsError("failed-precondition", "NOT_ENABLED");
    }

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const statsRef = db.doc(`centers/${centerId}/stats/postersMonthly/${monthKey}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(statsRef);
      const used = Number(snap.data()?.used || 0);
      const limitValue =
        typeof marketing.monthlyPosterLimit === "number" ? marketing.monthlyPosterLimit : 0;
      if (limitValue !== -1 && used >= limitValue) {
        throw new functions.https.HttpsError("resource-exhausted", "LIMIT_REACHED");
      }
      tx.set(
        statsRef,
        {
          used: used + 1,
          limit: limitValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    const centerSnap = await db.doc(`centers/${centerId}`).get();
    const centerName = String(centerSnap.data()?.name || "Centro Médico");
    const centerLogoUrl = String(centerSnap.data()?.logoUrl || "");

    const svg = buildPosterSvg({ centerName, message, format, centerLogoUrl });
    const imageDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    if (!allowPosterRetention || !retentionEnabled) {
      return { imageDataUrl };
    }

    const posterId = randToken(12);
    const storagePath = `centers/${centerId}/posters/${monthKey}/${posterId}.svg`;
    const bucket = storage.bucket();
    await bucket.file(storagePath).save(svg, {
      contentType: "image/svg+xml",
      metadata: {
        cacheControl: "public,max-age=3600",
      },
    });

    const createdAt = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      createdAt.toMillis() + retentionDays * 24 * 60 * 60 * 1000
    );
    await db.doc(`centers/${centerId}/posters/${posterId}`).set({
      format,
      message,
      storagePath,
      createdAt,
      createdBy: context.auth?.uid || null,
      monthKey,
      expiresAt,
    });

    return { imageDataUrl, storagePath };
  }
);

export const cleanupExpiredPosters = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const expired = await db.collectionGroup("posters").where("expiresAt", "<=", now).limit(50).get();
    if (expired.empty) return null;

    const bucket = storage.bucket();
    const batch = db.batch();

    await Promise.all(
      expired.docs.map(async (docSnap) => {
        const data = docSnap.data() as any;
        const storagePath = String(data.storagePath || "");
        if (storagePath) {
          try {
            await bucket.file(storagePath).delete();
          } catch (e) {
            functions.logger.warn("poster cleanup delete storage", { storagePath, error: e });
          }
        }
        batch.delete(docSnap.ref);
      })
    );

    await batch.commit();
    return null;
  });
