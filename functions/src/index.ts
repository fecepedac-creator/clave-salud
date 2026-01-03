import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

admin.initializeApp();

const BOOTSTRAP_UID = "RGjztaMcPFadH3Mn2Ruoauj1oTD2";

export const setSuperAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const callerUid = request.auth.uid;
  const token = request.auth.token as { superadmin?: boolean };
  const callerIsSuperadmin = token.superadmin === true;

  if (!callerIsSuperadmin && callerUid !== BOOTSTRAP_UID) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }

  const targetUid = String(request.data?.uid ?? "").trim();
  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Falta UID destino.");
  }

  await admin.auth().setCustomUserClaims(targetUid, {
    superadmin: true,
  });

  return {
    ok: true,
    uid: targetUid,
    superadmin: true,
  };
});
