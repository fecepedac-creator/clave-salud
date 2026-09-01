const admin = require("firebase-admin");
const functions = require("firebase-functions/v1");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isSuperAdmin = (context) => {
  const token = context.auth?.token || {};
  const roles = Array.isArray(token.roles) ? token.roles : [];
  return token.super_admin === true || token.superadmin === true || roles.includes("super_admin");
};

const canUseSecretaryInbox = async (uid, centerId) => {
  const staff = await db.collection("centers").doc(centerId).collection("staff").doc(uid).get();
  if (!staff.exists) return false;
  const data = staff.data() || {};
  if (data.active !== true && data.activo !== true) return false;
  const capabilities = Array.isArray(data.capabilities) ? data.capabilities : [];
  const role = normalizeRole(data.accessRole || data.role);
  return (
    capabilities.includes("whatsapp.inbox") ||
    [
      "center_admin",
      "admin_centro",
      "admin",
      "administrative",
      "administrativo",
      "secretaria",
      "secretary",
    ].includes(role)
  );
};

const isoDate = (value) => {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return typeof value === "string" ? value : null;
};

const safeMessage = (message, role) => {
  const source = message || {};
  return {
    role,
    text: String(source.text || "").slice(0, 1500),
    at: String(source.at || "").slice(0, 64),
  };
};

const requireInboxAccess = async (data, context) => {
  const centerId = String(data?.centerId || "").trim();
  const uid = context.auth?.uid || "";
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  if (!centerId) throw new functions.https.HttpsError("invalid-argument", "centerId es requerido.");
  if (!(isSuperAdmin(context) || (await canUseSecretaryInbox(uid, centerId)))) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tiene acceso a la operación de secretaría."
    );
  }
  return { centerId, uid };
};

exports.listSecretaryConversations = functions.https.onCall(async (data, context) => {
  const { centerId } = await requireInboxAccess(data, context);
  const snapshot = await db.collection("conversations").where("centerId", "==", centerId).limit(100).get();
  const conversations = snapshot.docs
    .map((item) => {
      const value = item.data() || {};
      const transcript = Array.isArray(value.transcript) ? value.transcript.slice(-30) : [];
      const secretaryMessages = Array.isArray(value.secretaryMessages)
        ? value.secretaryMessages.slice(-30)
        : [];
      return {
        id: item.id,
        patientName: String(value.patientName || "Paciente").slice(0, 160),
        patientPhone: String(value.patientPhone || item.id.split("_").pop() || "").slice(0, 32),
        phase: String(value.phase || "ACTIVE").slice(0, 32),
        handoffStatus: String(value.handoffStatus || "").slice(0, 32),
        updatedAt: isoDate(value.updatedAt) || isoDate(value.lastInboundAt),
        lastInboundAt: isoDate(value.lastInboundAt),
        transcript: transcript.map((message) =>
          safeMessage(message, message?.role === "model" ? "bot" : "patient")
        ),
        secretaryMessages: secretaryMessages.map((message) => safeMessage(message, "secretary")),
      };
    })
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { conversations };
});

exports.listSecretaryHandoffs = functions.https.onCall(async (data, context) => {
  const { centerId } = await requireInboxAccess(data, context);
  const snapshot = await db
    .collection("centers")
    .doc(centerId)
    .collection("handoff_requests")
    .orderBy("requestedAt", "desc")
    .limit(100)
    .get();
  return {
    requests: snapshot.docs.map((item) => {
      const value = item.data() || {};
      return {
        id: item.id,
        patientName: String(value.patientName || "Paciente").slice(0, 160),
        patientPhone: String(value.patientPhone || "").slice(0, 32),
        reason: String(value.reason || "Solicitud general").slice(0, 600),
        status: ["pending", "taken", "resolved"].includes(String(value.status))
          ? String(value.status)
          : "pending",
        requestedAt: isoDate(value.requestedAt),
        assignedTo: String(value.assignedTo || "").slice(0, 128),
      };
    }),
  };
});

exports.updateSecretaryHandoffStatus = functions.https.onCall(async (data, context) => {
  const { centerId, uid } = await requireInboxAccess(data, context);
  const requestId = String(data?.requestId || "").trim();
  const status = String(data?.status || "").trim();
  if (!requestId || !["taken", "resolved"].includes(status)) {
    throw new functions.https.HttpsError("invalid-argument", "Solicitud o estado inválido.");
  }
  const ref = db.collection("centers").doc(centerId).collection("handoff_requests").doc(requestId);
  const current = await ref.get();
  if (!current.exists) throw new functions.https.HttpsError("not-found", "Solicitud no encontrada.");
  const previous = String(current.get("status") || "pending");
  if (previous === "resolved") {
    throw new functions.https.HttpsError("failed-precondition", "La solicitud ya está resuelta.");
  }
  await ref.update({
    status,
    ...(status === "taken"
      ? { assignedTo: uid, takenAt: admin.firestore.FieldValue.serverTimestamp() }
      : { resolvedAt: admin.firestore.FieldValue.serverTimestamp() }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection("centers").doc(centerId).collection("auditLogs").add({
    type: "ACTION",
    action: "SECRETARY_HANDOFF_STATUS_UPDATED",
    entityType: "appointment",
    entityId: requestId,
    actorUid: uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    metadata: { previousStatus: previous, status },
    details: "Estado de solicitud a secretaría actualizado.",
  });
  return { ok: true };
});
