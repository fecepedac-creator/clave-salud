import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

import * as crypto from "crypto";
import { sendEmail } from "./email";
import {
  UpsertCenterInputSchema,
  DecommissionCenterInputSchema,
  UpdateWhatsappConfigInputSchema,
  AcceptInviteInputSchema,
  CreateInviteInputSchema,
  BookPublicAppointmentInputSchema,
  IssuePublicAppointmentChallengeInputSchema,
  ListAppointmentsInputSchema,
  CancelAppointmentInputSchema,
  SetSuperAdminInputSchema,
  LogAuditInputSchema,
  GenerateMarketingPosterInputSchema,
  LinkPatientInputSchema,
  AssessPatientMigrationConsistencyInputSchema,
  CreateNotificationInputSchema,
} from "./schemas";
import { validateOrThrow } from "./validation";
import {
  PUBLIC_APPOINTMENT_CHALLENGE_TTL_MS,
  buildPublicAppointmentSubjectHash,
  hashPublicAppointmentChallengeToken,
  normalizePublicAppointmentPhone,
  type PublicAppointmentAction,
  verifyPublicAppointmentChallengeToken,
} from "./publicAppointmentSecurity";
import { comparePatientConsistency } from "./patientMigrationConsistency";
import {
  appendAuditLogInTransaction,
  buildActorFromContext,
  canonicalizeActiveFields,
  resolveActiveFlag,
  writeAuditLog,
} from "./immutableAudit";

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const storage = admin.storage();

const BACKUP_TOKEN = process.env.BACKUP_TOKEN || "";
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || "";
const BACKUP_PREFIX = process.env.BACKUP_PREFIX || "backups/firestore";

const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const METADATA_FLAVOR_HEADER = "Metadata-Flavor";
const PUBLIC_APPOINTMENT_RATE_LIMITS = {
  challenge: { maxAttempts: 12, windowMinutes: 10 },
  lookup: { maxAttempts: 8, windowMinutes: 10 },
  cancel: { maxAttempts: 5, windowMinutes: 10 },
  book: { maxAttempts: 5, windowMinutes: 10 },
} as const;

function getProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId || ""
  );
}

type CallableContext = {
  auth?: {
    uid?: string;
    token?: Record<string, any>;
  } | null;
  app?: {
    appId?: string;
  } | null;
};

function getBackupPrefix() {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const month = date.slice(0, 7);
  const time = now.toISOString().replace(/[:]/g, "-").replace(/\..+/, "");
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
    active: resolveActiveFlag(staffData),
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

async function isCenterAdminForCenter(uid: string, centerId: string): Promise<boolean> {
  const staffSnap = await db.collection("centers").doc(centerId).collection("staff").doc(uid).get();
  if (!staffSnap.exists) return false;
  const active = resolveActiveFlag(staffSnap.data() as Record<string, any> | undefined);
  if (!active) return false;
  const role = String(staffSnap.get("accessRole") || staffSnap.get("role") || "").trim();
  return role === "center_admin";
}

function randToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function formatChileanPhone(raw: string): string {
  return normalizePublicAppointmentPhone(raw);
}

function normalizeRut(value: string): string {
  return String(value || "")
    .replace(/[^0-9kK]/g, "")
    .toUpperCase();
}

function formatRUT(value: string): string {
  const cleanRut = normalizeRut(value);
  if (cleanRut.length < 2) return cleanRut;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

function getPatientIdByRut(rut: string): string {
  const clean = normalizeRut(rut);
  return clean ? `p_${clean}` : "";
}

function validateRUT(rut: string): boolean {
  const cleanRut = normalizeRut(rut);
  if (cleanRut.length < 2) return false;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();
  if (!/^\d+$/.test(body)) return false;

  let suma = 0;
  let multiplo = 2;

  for (let i = 1; i <= body.length; i++) {
    suma += multiplo * parseInt(body.charAt(body.length - i), 10);
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvCalculado =
    dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();

  return dv === dvCalculado;
}

function lowerEmailFromContext(context: CallableContext): string {
  const raw = (context.auth?.token as any)?.email ?? "";
  return String(raw || "")
    .trim()
    .toLowerCase();
}

async function assertCenterAvailableForPublicOperations(centerId: string) {
  const centerSnap = await db.collection("centers").doc(centerId).get();
  if (!centerSnap.exists) {
    throw new functions.https.HttpsError("not-found", "El centro no existe.");
  }
  const centerData = centerSnap.data() as Record<string, any> | undefined;
  if (!resolveActiveFlag(centerData)) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "El centro no está disponible para operaciones públicas."
    );
  }
}

function shouldRequirePublicAppointmentAppCheck(): boolean {
  return String(process.env.PUBLIC_APPOINTMENT_REQUIRE_APP_CHECK || "").trim() === "true";
}

function assertPublicAppointmentAppCheck(context: CallableContext) {
  if (!shouldRequirePublicAppointmentAppCheck()) return;
  if (context.app?.appId) return;
  throw new functions.https.HttpsError(
    "failed-precondition",
    "La verificacion de App Check es obligatoria para esta operacion."
  );
}

function buildPublicAppointmentRateLimitKey(
  action: keyof typeof PUBLIC_APPOINTMENT_RATE_LIMITS,
  centerId: string,
  rut: string,
  phone: string
) {
  return buildPublicAppointmentSubjectHash(action as PublicAppointmentAction, centerId, rut, phone);
}

async function assertPublicAppointmentRateLimit(
  action: keyof typeof PUBLIC_APPOINTMENT_RATE_LIMITS,
  centerId: string,
  rut: string,
  phone: string
) {
  const { maxAttempts, windowMinutes } = PUBLIC_APPOINTMENT_RATE_LIMITS[action];
  const key = buildPublicAppointmentRateLimitKey(action, centerId, rut, phone);
  const ref = db.collection("_publicRateLimits").doc(key);
  const now = admin.firestore.Timestamp.now();
  const windowMs = windowMinutes * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as Record<string, any> | undefined;
    const windowStartedAt = data?.windowStartedAt as admin.firestore.Timestamp | undefined;
    const attempts = typeof data?.attempts === "number" ? data.attempts : 0;
    const blockUntil = data?.blockUntil as admin.firestore.Timestamp | undefined;

    if (blockUntil && blockUntil.toMillis() > now.toMillis()) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Demasiados intentos. Intenta nuevamente en unos minutos."
      );
    }

    const windowExpired =
      !windowStartedAt || now.toMillis() - windowStartedAt.toMillis() >= windowMs;

    if (windowExpired) {
      tx.set(
        ref,
        {
          action,
          centerId,
          attempts: 1,
          windowStartedAt: now,
          lastAttemptAt: now,
        },
        { merge: true }
      );
      return;
    }

    if (attempts >= maxAttempts) {
      const nextBlockUntil = admin.firestore.Timestamp.fromMillis(now.toMillis() + windowMs);
      tx.set(
        ref,
        {
          action,
          centerId,
          attempts: attempts + 1,
          lastAttemptAt: now,
          blockUntil: nextBlockUntil,
        },
        { merge: true }
      );
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Demasiados intentos. Intenta nuevamente en unos minutos."
      );
    }

    tx.set(
      ref,
      {
        action,
        centerId,
        attempts: attempts + 1,
        lastAttemptAt: now,
      },
      { merge: true }
    );
  });
}

async function consumePublicAppointmentChallenge(params: {
  centerId: string;
  action: PublicAppointmentAction;
  rut: string;
  phone: string;
  challengeId: string;
  challengeToken: string;
}) {
  const challengeRef = db.collection("_publicAppointmentChallenges").doc(params.challengeId);
  const subjectHash = buildPublicAppointmentSubjectHash(
    params.action,
    params.centerId,
    params.rut,
    params.phone
  );

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists) {
      throw new functions.https.HttpsError("permission-denied", "Challenge no valido.");
    }

    const data = snap.data() as Record<string, any> | undefined;
    const expiresAt = data?.expiresAt as admin.firestore.Timestamp | undefined;
    const usedAt = data?.usedAt as admin.firestore.Timestamp | undefined;

    if (!data || data.centerId !== params.centerId || data.action !== params.action) {
      throw new functions.https.HttpsError("permission-denied", "Challenge fuera de contexto.");
    }
    if (data.subjectHash !== subjectHash) {
      throw new functions.https.HttpsError("permission-denied", "Challenge no corresponde a los datos enviados.");
    }
    if (!verifyPublicAppointmentChallengeToken(params.challengeToken, data.challengeHash)) {
      throw new functions.https.HttpsError("permission-denied", "Challenge no valido.");
    }
    if (usedAt) {
      throw new functions.https.HttpsError("permission-denied", "Challenge ya utilizado.");
    }
    if (!expiresAt || expiresAt.toMillis() <= Date.now()) {
      throw new functions.https.HttpsError("deadline-exceeded", "Challenge expirado.");
    }

    tx.update(challengeRef, {
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
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

    const validated = validateOrThrow(CreateInviteInputSchema, data);
    const centerId = validated.centerId;
    const emailLower = validated.adminEmail.trim().toLowerCase();
    const centerName = validated.centerName;

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

    await db
      .collection("invites")
      .doc(newToken)
      .set({
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

    const validated = validateOrThrow(CreateNotificationInputSchema, data);
    const centerId = validated.centerId;
    const title = validated.title;
    const body = validated.body;
    const type = validated.type;
    const severity = validated.severity;

    const notifRef = db.collection("centers").doc(centerId).collection("adminNotifications").doc();

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

    await db
      .collection("centers")
      .doc(centerId)
      .collection("auditLogs")
      .add({
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

export const sendTestTransactionalEmail = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    requireAuth(context);

    const centerId = String(data?.centerId || "").trim();
    if (!centerId) {
      throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
    }

    const centerAdmin = await isCenterAdminForCenter(context.auth?.uid as string, centerId);
    if (!(isSuperAdmin(context) || centerAdmin)) {
      throw new functions.https.HttpsError("permission-denied", "No tiene permisos suficientes.");
    }

    const to = String(data?.to || "").trim();
    const subject = String(data?.subject || "Prueba email ClaveSalud").trim();
    const text = String(
      data?.text ||
        "Este es un envío de prueba de la capa transaccional de email desde Cloud Functions."
    ).trim();

    if (!to) {
      throw new functions.https.HttpsError("invalid-argument", "to es requerido.");
    }

    try {
      const result = await sendEmail({
        to,
        subject,
        text,
        centerId,
        tags: ["smoke-test"],
        type: "smoke_test",
        relatedType: "manual_test",
        relatedEntityId: String(data?.relatedEntityId || "").trim() || undefined,
      });
      return { ok: true, provider: result.provider, messageId: result.messageId || null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new functions.https.HttpsError("internal", `Error enviando email: ${message}`);
    }
  }
);

export const upsertCenter = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    requireAuth(context);
    if (!isSuperAdmin(context)) {
      throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
    }

    const validated = validateOrThrow(UpsertCenterInputSchema, data);
    const centerId = validated.id;
    const name = validated.name;
    const slug = validated.slug;
    const auditReason = validated.auditReason || "";

    const centerRef = db.collection("centers").doc(centerId);
    const existingSnap = await centerRef.get();
    const existingData = existingSnap.exists ? (existingSnap.data() as any) : {};

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
        const actor = buildActorFromContext(context, {
          uid: "unknown",
          email: "unknown",
          name: "Superadmin",
          role: "super_admin",
        });
        await writeAuditLog({
          centerId,
          type: "ACTION",
          action: "CENTER_STATUS_CHANGED",
          entityType: "centerSettings",
          entityId: centerId,
          ...actor,
          actorRole: "super_admin",
          resourceType: "centerSettings",
          resourcePath: `/centers/${centerId}`,
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

    const validated = validateOrThrow(DecommissionCenterInputSchema, data);
    const centerId = validated.centerId;
    const reason = validated.reason;

      await db.collection("centers").doc(centerId).update({
        active: false,
        isActive: false,
        decommissionedAt: admin.firestore.FieldValue.serverTimestamp(),
        decommissionReason: reason || "No especificado",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const actor = buildActorFromContext(context, {
        uid: "unknown",
        role: "super_admin",
      });
      await writeAuditLog({
        centerId,
        type: "ACTION",
        action: "DECOMMISSION_CENTER",
        entityType: "centerSettings",
        entityId: centerId,
        ...actor,
        actorRole: "super_admin",
        resourceType: "centerSettings",
        resourcePath: `/centers/${centerId}`,
        details: reason || null,
        metadata: { decommissioned: true },
      });

    return { ok: true, centerId };
  }
);

export const setSuperAdmin = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    requireAuth(context);

    const callerUid = context.auth?.uid as string;
    const callerEmail = lowerEmailFromContext(context);

    // Hardened: Only an existing SuperAdmin can promote another user (or themselves)
    // The previous whitelist-based elevation is removed for security (audit P1)
    if (!isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No tienes permisos de SuperAdmin para elevar privilegios."
      );
    }

    const validated = validateOrThrow(SetSuperAdminInputSchema, data);
    const targetUid = validated.uid;
    const action = validated.action;

    const targetUser = await admin.auth().getUser(targetUid);
    const existingClaims = (targetUser.customClaims || {}) as Record<string, unknown>;
    await admin.auth().setCustomUserClaims(targetUid, {
      ...existingClaims,
      super_admin: action === "set",
    });

      await writeAuditLog({
        type: "ACTION",
        action: action === "set" ? "SET_SUPER_ADMIN" : "UNSET_SUPER_ADMIN",
        entityType: "user",
        entityId: targetUid,
        actorUid: callerUid,
        actorEmail: callerEmail || null,
        actorRole: "super_admin",
        resourceType: "user",
        resourcePath: `/users/${targetUid}`,
        details: `Super admin claim ${action}.`,
      });

    return { ok: true, targetUid };
  }
);

export const acceptInvite = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    requireAuth(context);
    const validated = validateOrThrow(AcceptInviteInputSchema, data);
    const token = validated.token;

    const uid = context.auth?.uid as string;
    const emailLower = lowerEmailFromContext(context);
    if (!emailLower)
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Tu cuenta no tiene email disponible."
      );

    const invRef = db.collection("invites").doc(token);
    const invSnap = await invRef.get();
    if (!invSnap.exists)
      throw new functions.https.HttpsError("not-found", "Invitación no encontrada o inválida.");

    const inv: any = invSnap.data() || {};
    if (String(inv.status || "") !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Esta invitación ya fue utilizada o no está activa."
      );
    }

    const expiresAt = inv.expiresAt;
    if (expiresAt?.toDate) {
      if (expiresAt.toDate().getTime() < Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "La invitación expiró.");
      }
    }

    if (String(inv.emailLower || "").toLowerCase() !== emailLower) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Este correo no coincide con el invitado."
      );
    }

    const centerId = String(inv.centerId || "").trim();
    if (!centerId)
      throw new functions.https.HttpsError("failed-precondition", "Invitación sin centerId.");

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
            ...canonicalizeActiveFields({ active: true }),
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
            ...canonicalizeActiveFields({ active: true }),
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
          professionalRole:
            profileData.clinicalRole ?? profileData.role ?? inv.professionalRole ?? "",
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
  async (data: any, context: CallableContext) => {
    assertPublicAppointmentAppCheck(context);
    const validated = validateOrThrow(ListAppointmentsInputSchema, data);
    const centerId = validated.centerId;
    const patientRut = validated.rut;
    const phone = formatChileanPhone(validated.phone);

    await assertCenterAvailableForPublicOperations(centerId);
    await assertPublicAppointmentRateLimit("lookup", centerId, patientRut, phone);
    await consumePublicAppointmentChallenge({
      centerId,
      action: "lookup",
      rut: patientRut,
      phone,
      challengeId: validated.challengeId,
      challengeToken: validated.challengeToken,
    });

    const snap = await db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .where("status", "==", "booked")
      .where("patientRut", "==", patientRut)
      .where("patientPhone", "==", phone)
      .limit(25)
      .get();

    const appointments = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as any),
    }));
    return { appointments };
  }
);

export const cancelPatientAppointment = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    assertPublicAppointmentAppCheck(context);
    const validated = validateOrThrow(CancelAppointmentInputSchema, data);
    const centerId = validated.centerId;
    const appointmentId = validated.appointmentId;
    const patientRut = validated.rut;
    const phone = formatChileanPhone(validated.phone);

    await assertCenterAvailableForPublicOperations(centerId);
    await assertPublicAppointmentRateLimit("cancel", centerId, patientRut, phone);
    await consumePublicAppointmentChallenge({
      centerId,
      action: "cancel",
      rut: patientRut,
      phone,
      challengeId: validated.challengeId,
      challengeToken: validated.challengeToken,
    });

    const ref = db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .doc(appointmentId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "La cita no existe.");
      }
      const data = snap.data() as any;
      if (data.status !== "booked") {
        throw new functions.https.HttpsError("failed-precondition", "La cita no está reservada.");
      }
      if (
        String(data.patientRut || "") !== patientRut ||
        String(data.patientPhone || "") !== phone
      ) {
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

export const bookPublicAppointment = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    assertPublicAppointmentAppCheck(context);
    const validated = validateOrThrow(BookPublicAppointmentInputSchema, data);
    const centerId = validated.centerId;
    const appointmentId = validated.appointmentId;
    const doctorId = validated.doctorId;
    const patientName = validated.patientName.trim();
    const normalizedRut = normalizeRut(validated.rut);
    const formattedRut = formatRUT(normalizedRut);
    const phone = formatChileanPhone(validated.phone);
    const email = String(validated.email || "")
      .trim()
      .toLowerCase();

    if (!validateRUT(normalizedRut)) {
      throw new functions.https.HttpsError("invalid-argument", "RUT inválido.");
    }

    await assertCenterAvailableForPublicOperations(centerId);
    await assertPublicAppointmentRateLimit("book", centerId, formattedRut, phone);
    await consumePublicAppointmentChallenge({
      centerId,
      action: "book",
      rut: formattedRut,
      phone,
      challengeId: validated.challengeId,
      challengeToken: validated.challengeToken,
    });

    const patientId = getPatientIdByRut(normalizedRut);
    const appointmentRef = db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .doc(appointmentId);
    const patientRef = db.collection("patients").doc(patientId);

    const result = await db.runTransaction(async (tx) => {
      const appointmentSnap = await tx.get(appointmentRef);
      if (!appointmentSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "El horario ya no existe. El profesional puede haberlo cerrado recientemente."
        );
      }

      const appointmentData = appointmentSnap.data() as Record<string, any>;
      if (appointmentData.status !== "available") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Este horario acaba de ser reservado por otro paciente. Por favor, selecciona otro bloque."
        );
      }
      if (appointmentData.centerId !== centerId) {
        throw new functions.https.HttpsError("permission-denied", "El horario no pertenece al centro.");
      }
      if (
        appointmentData.doctorId !== doctorId &&
        String(appointmentData.doctorUid || "") !== doctorId
      ) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "El horario ya no coincide con el profesional seleccionado."
        );
      }
      if (appointmentData.date !== validated.date) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "La fecha seleccionada ya no coincide con el horario disponible."
        );
      }

      const today = new Date().toISOString().split("T")[0];
      if (String(appointmentData.date || "") < today) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "No se puede reservar una hora en una fecha pasada."
        );
      }

      tx.update(appointmentRef, {
        status: "booked",
        patientName,
        patientRut: formattedRut,
        patientId,
        patientPhone: phone,
        patientEmail: email || null,
        serviceId: validated.serviceId || null,
        serviceName: validated.serviceName || null,
        bookedAt: admin.firestore.FieldValue.serverTimestamp(),
        bookedVia: "patient_portal_callable",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const patientSnap = await tx.get(patientRef);
      if (!patientSnap.exists) {
        const ownerUid = String(appointmentData.doctorUid || appointmentData.doctorId || doctorId);
        tx.set(patientRef, {
          id: patientId,
          ownerUid,
          accessControl: {
            allowedUids: ownerUid ? [ownerUid] : [],
            centerIds: [centerId],
          },
          centerId,
          rut: formattedRut,
          fullName: patientName,
          birthDate: "",
          gender: "Otro",
          phone,
          email: email || undefined,
          medicalHistory: [],
          surgicalHistory: [],
          smokingStatus: "No fumador",
          alcoholStatus: "No consumo",
          medications: [],
          allergies: [],
          consultations: [],
          attachments: [],
          lastUpdated: new Date().toISOString(),
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(patientRef, {
          centerId,
          phone,
          email: email || patientSnap.get("email") || null,
          fullName: patientName,
          active: true,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          "accessControl.centerIds": admin.firestore.FieldValue.arrayUnion(centerId),
        });
      }

      return {
        id: appointmentId,
        ...(appointmentData as any),
        status: "booked",
        patientName,
        patientRut: formattedRut,
        patientId,
        patientPhone: phone,
        patientEmail: email || undefined,
        serviceId: validated.serviceId || undefined,
        serviceName: validated.serviceName || undefined,
        bookedVia: "patient_portal_callable",
        bookedAt: new Date().toISOString(),
      };
    });

    return { ok: true, appointment: result };
  }
);

export const issuePublicAppointmentChallenge = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    assertPublicAppointmentAppCheck(context);
    const validated = validateOrThrow(IssuePublicAppointmentChallengeInputSchema, data);
    const centerId = validated.centerId;
    const action = validated.action;
    const rut = validated.rut;
    const phone = formatChileanPhone(validated.phone);

    await assertCenterAvailableForPublicOperations(centerId);
    await assertPublicAppointmentRateLimit("challenge", centerId, rut, phone);

    const challengeId = randToken(16);
    const challengeToken = randToken(24);
    const now = Date.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now + PUBLIC_APPOINTMENT_CHALLENGE_TTL_MS);

    await db.collection("_publicAppointmentChallenges").doc(challengeId).set({
      id: challengeId,
      centerId,
      action,
      subjectHash: buildPublicAppointmentSubjectHash(action, centerId, rut, phone),
      challengeHash: hashPublicAppointmentChallengeToken(challengeToken),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      usedAt: null,
      appId: context.app?.appId ?? null,
    });

    return {
      challengeId,
      challengeToken,
      expiresAt: expiresAt.toMillis(),
    };
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
      if (!requestedCenterId && !resolveActiveFlag(centerData)) {
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

          const currentClinicalRole = normalizeString(
            currentStaff.clinicalRole ?? currentStaff.professionalRole ?? ""
          ).trim();
          if (!currentClinicalRole) {
            const legacyRole = normalizeString(currentStaff.role ?? "").trim();
            if (
              legacyRole &&
              legacyRole.toLowerCase() !== "center_admin" &&
              !["doctor", "admin"].includes(legacyRole.toLowerCase())
            ) {
              staffPatch.clinicalRole = legacyRole;
            }
          }

          const fullName = normalizeString(currentStaff.fullName ?? "").trim();
          if (!fullName) {
            const fallbackName = normalizeString(
              currentStaff.displayName ?? currentStaff.name ?? ""
            ).trim();
            if (fallbackName) {
              staffPatch.fullName = fallbackName;
            }
          }

          if (Object.keys(staffPatch).length > 0) {
            await centersRef
              .doc(centerId)
              .collection("staff")
              .doc(staffUid)
              .set(
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
          const publicData = buildPublicStaffData(
            staffUid,
            centerId,
            mergedStaffData,
            existingCreatedAt
          );
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
  async (data: any, context: CallableContext): Promise<any> => {
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

      const isStaffMember =
        staffSnap.exists && resolveActiveFlag(staffSnap.data() as Record<string, any> | undefined);

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
            if (timeSinceLastLog < 60000) {
              // 60 segundos
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
          await appendAuditLogInTransaction(transaction, {
            centerId,
            type: "ACCESS",
            action: "ACCESS",
            entityType: resourceType,
            entityId,
            actorUid: uid,
            actorEmail: emailLower,
            actorName,
            actorRole: role,
            resourceType,
            resourcePath,
            patientId: data.patientId ? String(data.patientId).trim() : null,
            ip: data.ip ? String(data.ip).trim() : null,
            userAgent: data.userAgent ? String(data.userAgent).trim() : null,
          }, auditLogRef);

          // Escribir el log y actualizar el documento de deduplicación
          transaction.set(
            dedupeDocRef,
            {
            timestamp: serverTimestamp(),
            resourcePath,
            actorUid: uid,
          },
          { merge: true }
        );

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
      throw new functions.https.HttpsError("internal", "Error al registrar el acceso.");
    }
  }
);

export const logAuditEvent = (functions.https.onCall as any)(
  async (data: any, context: CallableContext): Promise<any> => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario no autenticado.");
    }

    const validated = validateOrThrow(LogAuditInputSchema, data);
    const centerId = validated.centerId;
    const action = validated.action;
    const entityType = validated.entityType;
    const entityId = validated.entityId;

    // validEntityTypes check removed (handled by Zod)

    const uid = context.auth.uid as string;
    const emailLower = lowerEmailFromContext(context);

    const staffRef = db.collection("centers").doc(centerId).collection("staff").doc(uid);
    const staffSnap = await staffRef.get();
      const isStaffMember =
        staffSnap.exists && resolveActiveFlag(staffSnap.data() as Record<string, any> | undefined);

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

      const isClinicalEntity = ["patient", "consultation", "appointment"].includes(entityType);
      const resourceType = isClinicalEntity ? entityType : "centerSettings";
      const resourcePath = isClinicalEntity
        ? entityType === "patient"
          ? `/patients/${entityId}`
          : entityType === "consultation"
            ? data.patientId
              ? `/patients/${String(data.patientId).trim()}/consultations/${entityId}`
              : `/consultations/${entityId}`
            : `/centers/${centerId}/appointments/${entityId}`
        : `/centers/${centerId}`;
      await writeAuditLog({
        centerId,
        type: "ACTION",
        action,
        entityType,
        entityId,
        actorUid: uid,
        actorEmail: emailLower,
        actorName,
        actorRole,
        resourceType,
        resourcePath,
        patientId: data.patientId ? String(data.patientId).trim() : null,
        details: typeof data.details === "string" && data.details.trim() ? data.details.trim() : null,
        metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : null,
      });

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
    await storage
      .bucket(BACKUP_BUCKET)
      .file(`${prefix}/manifest.json`)
      .save(JSON.stringify({ ...manifest, dryRun: true }, null, 2), {
        contentType: "application/json",
      });
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
    await storage
      .bucket(BACKUP_BUCKET)
      .file(`${prefix}/manifest.json`)
      .save(JSON.stringify({ ...manifest, export: exportBody }, null, 2), {
        contentType: "application/json",
      });

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
    const validated = validateOrThrow(GenerateMarketingPosterInputSchema, data);
    const centerId = validated.centerId;
    const format = validated.format;
    const message = validated.message;

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

export const cleanupExpiredPosters = functions.pubsub.schedule("every 24 hours").onRun(async () => {
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

// migratePatients - One-time migration from centers/[centerId]/patients to root /patients
// Callable function restricted to SuperAdmins.
// Call with { dryRun: true } to preview changes without writing.
// Call with { dryRun: false } to execute the migration.
// Usage from Firebase Functions Shell:
//   firebase functions:shell
//   > migratePatients({ data: { dryRun: true } })
// Or call from the app's SuperAdmin dashboard.
export const migratePatients = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data, context) => {
    requireAuth(context);
    if (!isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo SuperAdmins pueden ejecutar la migración."
      );
    }

    const dryRun = data?.dryRun !== false; // Default to dryRun=true for safety
    const log: string[] = [];
    const addLog = (msg: string) => {
      log.push(msg);
      functions.logger.info(msg);
    };

    addLog(`🚀 Migration started (mode: ${dryRun ? "DRY RUN" : "LIVE"})`);

    const centersSnap = await db.collection("centers").get();
    addLog(`Found ${centersSnap.size} centers`);

    let totalPatients = 0;
    let totalConsultations = 0;
    let totalSkipped = 0;

    for (const centerDoc of centersSnap.docs) {
      const centerId = centerDoc.id;
      addLog(`\n📋 Processing center: ${centerId}`);

      // Get patients
      const patientsSnap = await db
        .collection("centers")
        .doc(centerId)
        .collection("patients")
        .get();
      if (patientsSnap.empty) {
        addLog(`  ⚠️  No patients in ${centerId}`);
        continue;
      }
      addLog(`  Found ${patientsSnap.size} patients`);

      // Get staff for default owner
      const staffSnap = await db.collection("centers").doc(centerId).collection("staff").get();
      const staffList: any[] = [];
      staffSnap.forEach((d) => staffList.push({ uid: d.id, ...d.data() }));

      const defaultOwner =
        staffList.find(
          (s: any) =>
            s.roles?.includes("doctor") ||
            s.roles?.includes("MEDICO") ||
            s.roles?.includes("professional")
        ) || staffList[0];
      const defaultOwnerUid = defaultOwner?.uid || "migration-orphan";
      addLog(`  Default owner: ${defaultOwnerUid}`);

      // Get consultations indexed by patientId
      const consultSnap = await db
        .collection("centers")
        .doc(centerId)
        .collection("consultations")
        .get();
      const consultsByPatient: Record<string, any[]> = {};
      consultSnap.forEach((d) => {
        const cd = d.data();
        if (cd.patientId) {
          if (!consultsByPatient[cd.patientId]) consultsByPatient[cd.patientId] = [];
          consultsByPatient[cd.patientId].push({ id: d.id, ...cd });
        }
      });

      // Migrate each patient
      for (const patDoc of patientsSnap.docs) {
        const pd = patDoc.data();
        const patientId = patDoc.id;

        // Skip if already migrated
        const existingRoot = await db.collection("patients").doc(patientId).get();
        if (existingRoot.exists) {
          addLog(`  ⏭️  ${patientId} (${pd.fullName || "?"}) — already exists`);
          totalSkipped++;
          continue;
        }

        // Determine owner from consultation creator or default
        const patConsults = consultsByPatient[patientId] || [];
        const creatorUid = patConsults.find((c: any) => c.createdByUid)?.createdByUid;
        const ownerUid = creatorUid || defaultOwnerUid;

        const migratedPatient = {
          ...pd,
          id: patientId,
          ownerUid,
          accessControl: {
            allowedUids: [ownerUid],
            centerIds: [centerId],
          },
          centerId,
          migratedFrom: `centers/${centerId}/patients/${patientId}`,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (!dryRun) {
          await db.collection("patients").doc(patientId).set(migratedPatient);
        }
        addLog(
          `  ${dryRun ? "[DRY]" : "✅"} ${patientId} (${pd.fullName || "?"}) → owner: ${ownerUid}`
        );
        totalPatients++;

        // Migrate consultations
        for (const c of patConsults) {
          if (!dryRun) {
            await db
              .collection("patients")
              .doc(patientId)
              .collection("consultations")
              .doc(c.id)
              .set({
                ...c,
                migratedFrom: `centers/${centerId}/consultations/${c.id}`,
                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
          }
          totalConsultations++;
        }
        if (patConsults.length > 0) {
          addLog(`    ${dryRun ? "[DRY]" : "✅"} ${patConsults.length} consultations`);
        }
      }
    }

    const summary = {
      ok: true,
      dryRun,
      totalPatients,
      totalConsultations,
      totalSkipped,
    };
    addLog(`\n📊 Summary: ${JSON.stringify(summary)}`);

    return { ...summary, log };
  });

export const assessPatientMigrationConsistency = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data, context) => {
    requireAuth(context);
    if (!isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo SuperAdmins pueden evaluar consistencia de migración."
      );
    }

    const validated = validateOrThrow(AssessPatientMigrationConsistencyInputSchema, data);
    const requestedCenterId = String(validated.centerId || "").trim();
    const requestedPatientId = String(validated.patientId || "").trim();
    const includeMatching = validated.includeMatching;
    const perCenterLimit = validated.limit;

    const centersDocs = requestedCenterId
      ? [await db.collection("centers").doc(requestedCenterId).get()].filter((docSnap) => docSnap.exists)
      : (await db.collection("centers").get()).docs;

    const report: Array<Record<string, any>> = [];
    let comparedPatients = 0;
    let okPatients = 0;
    let warningPatients = 0;
    let criticalPatients = 0;

    for (const centerDoc of centersDocs) {
      const centerId = centerDoc.id;
      const legacyPatientsRef = db.collection("centers").doc(centerId).collection("patients");
      const legacyPatientsDocs = requestedPatientId
        ? [await legacyPatientsRef.doc(requestedPatientId).get()].filter((docSnap) => docSnap.exists)
        : (await legacyPatientsRef.limit(perCenterLimit).get()).docs;

      if (legacyPatientsDocs.length === 0) {
        continue;
      }

      const legacyConsultationsSnap = await db
        .collection("centers")
        .doc(centerId)
        .collection("consultations")
        .get();

      const legacyConsultationsByPatient = new Map<string, Array<Record<string, any>>>();
      legacyConsultationsSnap.forEach((consultationDoc) => {
        const consultation: Record<string, any> = {
          id: consultationDoc.id,
          ...consultationDoc.data(),
        };
        const patientId = String(consultation.patientId || "").trim();
        if (!patientId) return;
        const current = legacyConsultationsByPatient.get(patientId) ?? [];
        current.push(consultation);
        legacyConsultationsByPatient.set(patientId, current);
      });

      for (const legacyPatientDoc of legacyPatientsDocs) {
        const patientId = legacyPatientDoc.id;
        const legacyPatient = legacyPatientDoc.data() as Record<string, any>;
        const rootPatientDoc = await db.collection("patients").doc(patientId).get();
        const rootPatient = rootPatientDoc.exists ? (rootPatientDoc.data() as Record<string, any>) : null;

        const rootConsultationsSnap = rootPatientDoc.exists
          ? await db.collection("patients").doc(patientId).collection("consultations").get()
          : null;

        const result = comparePatientConsistency({
          patientId,
          centerId,
          rootPatient,
          legacyPatient,
          rootConsultations: rootConsultationsSnap?.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) ?? [],
          legacyConsultations: legacyConsultationsByPatient.get(patientId) ?? [],
        });

        comparedPatients += 1;
        if (result.status === "ok") okPatients += 1;
        if (result.status === "warning") warningPatients += 1;
        if (result.status === "critical") criticalPatients += 1;

        if (includeMatching || result.status !== "ok") {
          report.push({
            centerId,
            ...result,
          });
        }
      }
    }

    return {
      ok: true,
      comparedPatients,
      okPatients,
      warningPatients,
      criticalPatients,
      report,
    };
  });

// ============================================================================
// AGGREGATED METRICS
// ============================================================================

/**
 * Mantiene un contador de staff activo en el documento del centro.
 * Trigger: centers/{centerId}/staff/{staffUid}
 */
export const aggregateStaff = functions.firestore
  .document("centers/{centerId}/staff/{staffUid}")
  .onWrite(async (change, context) => {
    const centerId = context.params.centerId;
    const centerRef = db.collection("centers").doc(centerId);
    let increment = 0;

    const before = change.before.data();
    const after = change.after.data();

    const wasActive = before ? resolveActiveFlag(before) : false;
    const isActive = after ? resolveActiveFlag(after) : false;

    if (!before && isActive) {
      increment = 1; // Created and active
    } else if (before && !after) {
      if (wasActive) increment = -1; // Deleted and was active
    } else {
      // Updated
      if (!wasActive && isActive) increment = 1;
      if (wasActive && !isActive) increment = -1;
    }

    if (increment !== 0) {
      await centerRef.set(
        {
          stats: {
            staffCount: admin.firestore.FieldValue.increment(increment),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    }
  });

/**
 * Mantiene un contador de citas agendadas (status: 'booked').
 * Trigger: centers/{centerId}/appointments/{apptId}
 */
export const aggregateAppointments = functions.firestore
  .document("centers/{centerId}/appointments/{apptId}")
  .onWrite(async (change, context) => {
    const centerId = context.params.centerId;
    const centerRef = db.collection("centers").doc(centerId);
    let increment = 0;

    const before = change.before.data();
    const after = change.after.data();

    // Helper to check if booked
    const isBooked = (d: any) => d && d.status === "booked";

    const wasBooked = isBooked(before);
    const nowBooked = isBooked(after);

    if (!wasBooked && nowBooked) increment = 1;
    if (wasBooked && !nowBooked) increment = -1;

    if (increment !== 0) {
      await centerRef.set(
        {
          stats: {
            appointmentCount: admin.firestore.FieldValue.increment(increment),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    }
  });

/**
 * Mantiene un contador de atenciones realizadas.
 * Trigger: patients/{patientId}/consultations/{consultationId}
 * Importante: se usa centerId dentro del documento para saber qué centro actualizar.
 */
export const aggregateConsultations = functions.firestore
  .document("patients/{patientId}/consultations/{consultationId}")
  .onWrite(async (change) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const data = afterData || beforeData;
    const centerId = data?.centerId;

    if (!centerId) return;
    const centerRef = db.collection("centers").doc(centerId);
    let increment = 0;

    if (!change.before.exists && change.after.exists) {
      increment = 1; // Creado
    } else if (change.before.exists && !change.after.exists) {
      increment = -1; // Borrado
    }

    if (increment !== 0) {
      await centerRef.set(
        {
          stats: {
            consultationCount: admin.firestore.FieldValue.increment(increment),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    }
  });

/**
 * Mantiene el contador de pacientes por centro.
 * Trigger: patients/{patientId}
 * Un paciente puede pertenecer a múltiples centros (accessControl.centerIds).
 */
export const aggregatePatients = functions.firestore
  .document("patients/{patientId}")
  .onWrite(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    const beforeCenters = new Set<string>(before?.accessControl?.centerIds || []);
    const afterCenters = new Set<string>(after?.accessControl?.centerIds || []);

    // Incrementar en centros nuevos
    for (const cId of afterCenters) {
      if (!beforeCenters.has(cId)) {
        await db
          .collection("centers")
          .doc(cId)
          .set(
            {
              stats: {
                patientCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
      }
    }

    // Decrementar en centros de los que salió
    for (const cId of beforeCenters) {
      if (!afterCenters.has(cId)) {
        await db
          .collection("centers")
          .doc(cId)
          .set(
            {
              stats: {
                patientCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
      }
    }
  });

/**
 * Callable para recalcular manualmente todas las estadísticas de un centro.
 * Solo SuperAdmin.
 */
export const recalcCenterStats = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data, context) => {
    requireAuth(context);
    if (!isSuperAdmin(context)) {
      throw new functions.https.HttpsError("permission-denied", "Solo SuperAdmin.");
    }

    const centerId = String(data?.centerId || "").trim();
    const centersRef = db.collection("centers");
    const targetCenters = centerId
      ? [centersRef.doc(centerId)]
      : (await centersRef.get()).docs.map((d) => d.ref);

    let processed = 0;

    for (const ref of targetCenters) {
      try {
        console.log(`Recalculating stats for center: ${ref.id}`);
        // 1. Count Active Staff
        const staffSnap = await ref.collection("staff").get();
        const staffCount = staffSnap.docs.filter((d) => {
          const data = d.data();
          return resolveActiveFlag(data);
        }).length;

        // 2. Count Booked Appointments
        const apptSnap = await ref.collection("appointments").where("status", "==", "booked").get();
        const appointmentCount = apptSnap.size;

        // 3. Count Consultations (Collection Group query since they are under patients)
        const consultSnap = await db
          .collectionGroup("consultations")
          .where("centerId", "==", ref.id)
          .count()
          .get();
        const consultationCount = consultSnap.data().count;

        // 4. Count Patients (Root collection /patients, filtering by accessControl.centerIds)
        const patientsSnap = await db
          .collection("patients")
          .where("accessControl.centerIds", "array-contains", ref.id)
          .count()
          .get();
        const patientCount = patientsSnap.data().count;

        await ref.set(
          {
            stats: {
              staffCount,
              patientCount,
              appointmentCount,
              consultationCount,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );
        processed++;
      } catch (err: any) {
        console.error(`Error processing center ${ref.id}:`, err);
        // We continue with other centers if one fails, but we might want to know why
        // If it's a 9 (FAILED_PRECONDITION), it's a missing index
        if (err.code === 9) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Falta índice para el centro ${ref.id}: ${err.message}`
          );
        }
      }
    }

    return { ok: true, processed };
  });

/**
 * Tarea programada para recalcular estadísticas de todos los centros cada 24 horas.
 */
export const scheduledRecalcStats = functions.pubsub.schedule("every 24 hours").onRun(async () => {
  const centersRef = db.collection("centers");
  const snapshot = await centersRef.get();

  for (const doc of snapshot.docs) {
    const ref = doc.ref;

    // Count Staff
    const staffSnap = await ref.collection("staff").get();
    const staffCount = staffSnap.docs.filter((d: any) => {
      const data = d.data();
      return resolveActiveFlag(data);
    }).length;

    // Count Appointments
    const apptSnap = await ref.collection("appointments").where("status", "==", "booked").get();
    const appointmentCount = apptSnap.size;

    // Count Consultations (Collection Group)
    const consultSnap = await db
      .collectionGroup("consultations")
      .where("centerId", "==", ref.id)
      .count()
      .get();
    const consultationCount = consultSnap.data().count;

    // Count Patients (Root collection /patients)
    const patientsSnap = await db
      .collection("patients")
      .where("accessControl.centerIds", "array-contains", ref.id)
      .count()
      .get();
    const patientCount = patientsSnap.data().count;

    await ref.set(
      {
        stats: {
          staffCount,
          patientCount,
          appointmentCount,
          consultationCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  }

  console.log(`[scheduledRecalcStats] Procesados ${snapshot.size} centros.`);
  return null;
});

/**
 * Permite a un profesional vincular un paciente a su lista de acceso si tiene una cita agendada.
 * Esto resuelve el problema de asociación cuando un paciente ya existe en el sistema global
 * pero reserva en un nuevo centro o profesional vía flujo público.
 */
export const linkPatientToProfessional = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    requireAuth(context);
    const uid = context.auth?.uid as string;

    const validated = validateOrThrow(LinkPatientInputSchema, data);
    const centerId = validated.centerId;
    const patientId = validated.patientId;

    // 1. Verificar que el profesional sea staff del centro y esté ACTIVO
    const staffDoc = await db
      .collection("centers")
      .doc(centerId)
      .collection("staff")
      .doc(uid)
      .get();
    const isStaffMember = staffDoc.exists;
    const isActive = resolveActiveFlag(staffDoc.data() as Record<string, any> | undefined);

    if (!isActive && !isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "El acceso profesional está desactivado o el usuario no existe."
      );
    }

    if (!isStaffMember && !isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No eres miembro del personal de este centro."
      );
    }

    // 2. Buscar si hay una cita agendada para este paciente en este centro
    // Usamos el patientId (que ahora es determinista p_RUT)
    const appointmentsSnap = await db
      .collection("centers")
      .doc(centerId)
      .collection("appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "booked")
      .limit(1)
      .get();

    if (appointmentsSnap.empty && !isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No se encontró una cita agendada para este paciente que justifique el acceso."
      );
    }

    // 3. Vincular al paciente
    const patientRef = db.collection("patients").doc(patientId);
    const patientSnap = await patientRef.get();

    if (!patientSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "El paciente no existe en la colección global."
      );
    }

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(patientRef);
        const pData = snap.data() as any;
        const currentAllowed = Array.isArray(pData?.accessControl?.allowedUids)
          ? pData.accessControl.allowedUids
          : [];
        const currentCenters = Array.isArray(pData?.accessControl?.centerIds)
          ? pData.accessControl.centerIds
          : [];

        const update: any = {};
        let changed = false;

        if (!currentAllowed.includes(uid)) {
          update["accessControl.allowedUids"] = admin.firestore.FieldValue.arrayUnion(uid);
          changed = true;
        }

        if (!currentCenters.includes(centerId)) {
          update["accessControl.centerIds"] = admin.firestore.FieldValue.arrayUnion(centerId);
          changed = true;
        }

        if (changed) {
          tx.update(patientRef, {
            ...update,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      return { ok: true, linked: true };
    } catch (error) {
      functions.logger.error("linkPatientToProfessional error", { error: String(error) });
      throw new functions.https.HttpsError("internal", "Error al vincular el paciente.");
    }
  }
);

export * from "./immutableAudit";
export * from "./whatsapp";
export * from "./performance";

// ─── WHATSAPP CONFIG (con cifrado de Access Token) ───────────────────────────
// Importamos la función de cifrado desde whatsapp.ts para reutilizar la misma
// lógica AES-256 sin duplicar código.
import { encryptToken } from "./whatsapp";

export const updateWhatsappConfig = (functions.https.onCall as any)(
  async (data: any, context: CallableContext) => {
    requireAuth(context);
    const uid = context.auth?.uid as string;

    const validated = validateOrThrow(UpdateWhatsappConfigInputSchema, data);
    const centerId = validated.centerId;

    // Verificar que el usuario es admin del centro o super_admin
    const isAdmin = await isCenterAdminForCenter(uid, centerId);
    if (!isAdmin && !isSuperAdmin(context)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo administradores del centro pueden actualizar la configuración de WhatsApp."
      );
    }

    const phoneNumberId = validated.phoneNumberId;
    const rawAccessToken = validated.accessToken || "";
    const secretaryPhone = validated.secretaryPhone || "";
    const verifyToken = validated.verifyToken || "";

    const centerRef = db.collection("centers").doc(centerId);

    const updates: Record<string, any> = {
      "whatsappConfig.phoneNumberId": phoneNumberId,
      "whatsappConfig.updatedAt": serverTimestamp(),
      "whatsappConfig.updatedByUid": uid,
    };

    // Solo actualizar el token si el admin envió uno nuevo (no el placeholder "********")
    if (rawAccessToken && rawAccessToken !== "********") {
      // Cifrar el token antes de persistir en Firestore
      const encryptedToken = encryptToken(rawAccessToken);
      updates["whatsappConfig.accessToken"] = encryptedToken;
      updates["whatsappConfig.tokenEncrypted"] = true;
    }

    if (secretaryPhone) {
      updates["whatsappConfig.secretaryPhone"] = secretaryPhone;
    }

    if (verifyToken) {
      updates["whatsappConfig.verifyToken"] = verifyToken;
    }

    await centerRef.update(updates);

    // Registro de auditoría
      await writeAuditLog({
        centerId,
        type: "ACTION",
        action: "WHATSAPP_CONFIG_UPDATED",
        entityType: "centerSettings",
        entityId: centerId,
        actorUid: uid,
        actorEmail: lowerEmailFromContext(context) || "unknown",
        actorRole: isAdmin ? "center_admin" : "super_admin",
        resourceType: "centerSettings",
        resourcePath: `/centers/${centerId}`,
        details: "Configuración de WhatsApp actualizada con token cifrado.",
      });

    console.log(`[updateWhatsappConfig] Centro ${centerId} actualizado por ${uid}. Token cifrado: ${!!rawAccessToken && rawAccessToken !== "********"}`);
    return { ok: true, tokenEncrypted: !!rawAccessToken && rawAccessToken !== "********" };
  }
);

