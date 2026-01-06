/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

function lowerEmailFromContext(context: functions.https.CallableContext): string {
  const raw = (context.auth?.token as any)?.email ?? "";
  return String(raw || "").trim().toLowerCase();
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
  