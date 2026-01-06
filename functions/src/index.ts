/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function isSuperAdmin(context: functions.https.CallableContext): boolean {
  const t: any = context.auth?.token || {};
  return (
    t.super_admin === true ||
    t.superadmin === true ||
    (Array.isArray(t.roles) && t.roles.includes("super_admin")) ||
    (Array.isArray(t.roles) && t.roles.includes("superadmin"))
  );
}

function requireAuth(context: functions.https.CallableContext) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
}

function randToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * createCenterAdminInvite
 * - Only SuperAdmin
 * - Creates invite doc under /invites/{token}
 * - Returns { token, inviteUrl }
 */
export const createCenterAdminInvite = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  if (!isSuperAdmin(context)) {
    throw new functions.https.HttpsError("permission-denied", "No tiene permisos de SuperAdmin.");
  }

  const centerId = String(data?.centerId || "").trim();
  const adminEmail = String(data?.adminEmail || "").trim().toLowerCase();
  const centerName = String(data?.centerName || "").trim();

  if (!centerId) throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  if (!adminEmail) throw new functions.https.HttpsError("invalid-argument", "adminEmail es requerido.");

  const token = randToken(24);
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 días

  await db.collection("invites").doc(token).set({
    token,
    centerId,
    centerName,
    adminEmailLower: adminEmail,
    role: "center_admin",
    createdAt: now,
    expiresAt,
    status: "pending",
    createdByUid: context.auth?.uid,
  });

  const inviteUrl = `https://clavesalud-2.web.app/invite?token=${token}`;
  return { token, inviteUrl };
});

/**
 * acceptInvite
 * - Requires auth
 * - Validates token + email match + not expired
 * - Grants role/center to the logged-in user in /users/{uid}
 * - Marks invite accepted
 */
export const acceptInvite = functions.https.onCall(async (data, context) => {
  requireAuth(context);

  const token = String(data?.token || "").trim();
  if (!token) throw new functions.https.HttpsError("invalid-argument", "token es requerido.");

  const uid = context.auth!.uid;
  const email = (context.auth!.token as any)?.email ? String((context.auth!.token as any).email).toLowerCase() : "";
  if (!email) throw new functions.https.HttpsError("failed-precondition", "Tu cuenta no tiene email disponible.");

  const ref = db.collection("invites").doc(token);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Invitación no encontrada o inválida.");

  const inv: any = snap.data() || {};
  if (inv.status !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", "Esta invitación ya fue utilizada o no está activa.");
  }
  if (typeof inv.expiresAt === "number" && Date.now() > inv.expiresAt) {
    throw new functions.https.HttpsError("failed-precondition", "La invitación expiró.");
  }
  if (String(inv.adminEmailLower || "").toLowerCase() !== email) {
    throw new functions.https.HttpsError("permission-denied", "Este correo no coincide con el invitado.");
  }

  const centerId = String(inv.centerId || "").trim();
  if (!centerId) throw new functions.https.HttpsError("failed-precondition", "Invitación sin centerId.");

  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    tx.set(userRef, {
      uid,
      email,
      updatedAt: Date.now(),
    }, { merge: true });

    tx.update(userRef, {
      roles: admin.firestore.FieldValue.arrayUnion("center_admin"),
      centers: admin.firestore.FieldValue.arrayUnion(centerId),
    });

    tx.update(ref, {
      status: "accepted",
      acceptedAt: Date.now(),
      acceptedUid: uid,
    });
  });

  return { ok: true, centerId, role: "center_admin" };
});
