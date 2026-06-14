import { expect, test } from "@playwright/test";
import admin from "firebase-admin";
import { disableAnimations } from "./fixtures/helpers";
import { TEST } from "./fixtures/test-data";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "clavesalud-2";
const centerId = TEST.CENTER_ID;

function getAdminApp() {
  if (!admin.apps.length) admin.initializeApp({ projectId });
  return admin.app();
}

function db() {
  getAdminApp();
  return admin.firestore();
}

function auth() {
  getAdminApp();
  return admin.auth();
}

function nowToken() {
  return `e2e_invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function deleteAuthUserByEmail(email: string) {
  try {
    const user = await auth().getUserByEmail(email);
    await auth().deleteUser(user.uid);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}

test.describe("Pilot invite flow", () => {
  test("temporary professional invite can be accepted atomically", async ({ page }) => {
    await disableAnimations(page);

    const token = nowToken();
    const tempStaffId = `${token}_temp`;
    const email = `${token}@example.test`;
    const password = "InviteTest2026!";
    let acceptedUid = "";

    await test.step("seed pending invite", async () => {
      await db().collection("invites").doc(token).set({
        token,
        email,
        emailLower: email,
        centerId,
        centerName: "Centro Medico Los Andes",
        role: "professional",
        status: "pending",
        tempStaffId,
        profileData: {
          fullName: "Profesional E2E Invitado",
          clinicalRole: "MEDICO",
          specialty: "Medicina General",
          visibleInBooking: false,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
        invitedByUid: "e2e",
      });
      await db().collection("centers").doc(centerId).collection("staff").doc(tempStaffId).set({
        uid: tempStaffId,
        email,
        emailLower: email,
        role: "professional",
        accessRole: "professional",
        clinicalRole: "MEDICO",
        professionalRole: "MEDICO",
        fullName: "Profesional E2E Invitado",
        active: true,
        activo: true,
        isTemp: true,
        visibleInBooking: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    try {
      await page.goto(`/invite?token=${encodeURIComponent(token)}`);
      await expect(page.getByRole("heading", { name: /crear cuenta/i })).toBeVisible({
        timeout: 30000,
      });

      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('input[type="password"]').nth(1).fill(password);
      await page.getByRole("button", { name: /^Crear cuenta$/i }).click();

      await expect(page.getByText(/invitaci.n aceptada/i).first()).toBeVisible({
        timeout: 60000,
      });

      const user = await auth().getUserByEmail(email);
      acceptedUid = user.uid;
      const [inviteSnap, userSnap, staffSnap, tempStaffSnap] = await Promise.all([
        db().collection("invites").doc(token).get(),
        db().collection("users").doc(acceptedUid).get(),
        db().collection("centers").doc(centerId).collection("staff").doc(acceptedUid).get(),
        db().collection("centers").doc(centerId).collection("staff").doc(tempStaffId).get(),
      ]);

      expect(inviteSnap.get("status")).toBe("accepted");
      expect(userSnap.get("centers")).toContain(centerId);
      expect(staffSnap.exists).toBe(true);
      expect(staffSnap.get("accessRole")).toBe("professional");
      expect(tempStaffSnap.get("active")).toBe(false);
      expect(tempStaffSnap.get("migratedToUid")).toBe(acceptedUid);
    } finally {
      const cleanup = db().batch();
      cleanup.delete(db().collection("invites").doc(token));
      cleanup.delete(db().collection("centers").doc(centerId).collection("staff").doc(tempStaffId));
      if (acceptedUid) {
        cleanup.delete(db().collection("centers").doc(centerId).collection("staff").doc(acceptedUid));
        cleanup.delete(db().collection("users").doc(acceptedUid));
      }
      await cleanup.commit();
      await deleteAuthUserByEmail(email);
    }
  });
});
