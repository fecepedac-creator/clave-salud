import { expect, test, type Page } from "@playwright/test";

const projectId = "clavesalud-2";
const firestoreBase = `http://127.0.0.1:8099/v1/projects/${projectId}/databases/(default)/documents`;
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts";
const functionsBase = `http://127.0.0.1:5001/${projectId}/us-central1`;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const firestoreValue = (value: JsonValue): Record<string, unknown> => {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, firestoreValue(nested)])
      ),
    },
  };
};

const firestoreFields = (value: { [key: string]: JsonValue }) =>
  Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, firestoreValue(nested)]));

async function adminSet(path: string, data: { [key: string]: JsonValue }) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields(data) }),
  });
  const responseText = await response.text();
  expect(response.ok, responseText).toBe(true);
}

async function createUser(email: string, password: string) {
  const response = await fetch(`${authBase}:signUp?key=emulator-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const responseText = await response.text();
  expect(response.ok, responseText).toBe(true);
  return JSON.parse(responseText) as { localId: string; idToken: string };
}

async function callable<T>(page: Page, name: string, token: string, data: unknown) {
  return page.evaluate(
    async ({ url, token: authToken, payload }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: payload }),
      });
      return { status: response.status, body: await response.json() };
    },
    { url: `${functionsBase}/${name}`, token, payload: data }
  ) as Promise<{
    status: number;
    body: { result?: T; error?: { status?: string; message?: string } };
  }>;
}

async function readDocument(page: Page, path: string, token: string) {
  return page.evaluate(
    async ({ url, token: authToken }) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return { status: response.status, text: await response.text() };
    },
    { url: `${firestoreBase}/${path}`, token }
  );
}

test("cita a borrador, recarga, firma y adenda; recepción denegada", async ({ page }) => {
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Este gate solo se ejecuta con emuladores.");
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const centerId = `center_gate_${suffix}`;
  const patientId = `patient_gate_${suffix}`;
  const appointmentId = `appointment_gate_${suffix}`;
  const password = "Synthetic-Only-123!";
  const professional = await createUser(`doctor.${suffix}@example.test`, password);
  const reception = await createUser(`reception.${suffix}@example.test`, password);

  await Promise.all([
    adminSet(`centers/${centerId}`, { name: "Centro sintético", accessMode: "CARE_TEAM" }),
    adminSet(`centers/${centerId}/staff/${professional.localId}`, {
      active: true,
      accessRole: "professional",
      clinicalRole: "MEDICO",
      fullName: "Profesional Sintético",
      rut: "11.111.111-1",
      capabilities: [
        "clinical_draft.create",
        "clinical_draft.edit_own",
        "clinical_record.sign",
        "clinical_record.addendum",
      ],
    }),
    adminSet(`centers/${centerId}/staff/${reception.localId}`, {
      active: true,
      accessRole: "administrative",
      role: "ADMINISTRATIVO",
      capabilities: ["agenda.read", "appointment.check_in"],
    }),
    adminSet(`patients/${patientId}`, {
      centerId,
      fullName: "Paciente Sintético Gate",
      ownerUid: professional.localId,
      careTeamUids: [professional.localId],
      accessControl: { centerIds: [centerId], allowedUids: [professional.localId] },
    }),
    adminSet(`centers/${centerId}/appointments/${appointmentId}`, {
      centerId,
      patientId,
      doctorId: professional.localId,
      doctorUid: professional.localId,
      date: "2099-08-18",
      time: "09:00",
      status: "booked",
      active: true,
    }),
  ]);

  await page.goto("/emulator-gate.html");
  await expect(page.getByText(/Harness local de emuladores/)).toBeVisible();
  const base = { centerId, patientId };
  const created = await callable<{ documentId: string }>(
    page,
    "createDraftFromAppointment",
    professional.idToken,
    {
      ...base,
      appointmentId,
      requestId: `create_${suffix}`,
      consultationType: "morbidity",
    }
  );
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const draftId = created.body.result?.documentId;
  expect(draftId).toBeTruthy();

  const updated = await callable(page, "updateOwnDraft", professional.idToken, {
    ...base,
    draftId,
    requestId: `update_${suffix}`,
    patch: { reason: "Control sintético", anamnesis: "Contenido de prueba sin PII real" },
  });
  expect(updated.status, JSON.stringify(updated.body)).toBe(200);

  await page.reload();
  const continuedDraft = await readDocument(
    page,
    `patients/${patientId}/consultations/${draftId}`,
    professional.idToken
  );
  expect(continuedDraft.status, continuedDraft.text).toBe(200);
  expect(continuedDraft.text).toContain('"stringValue": "draft"');
  expect(continuedDraft.text).toContain('"stringValue": "Control sintético"');

  const signed = await callable(page, "signDraft", professional.idToken, {
    ...base,
    draftId,
    requestId: `sign_${suffix}`,
  });
  expect(signed.status, JSON.stringify(signed.body)).toBe(200);
  const signedDocument = await readDocument(
    page,
    `patients/${patientId}/consultations/${draftId}`,
    professional.idToken
  );
  expect(signedDocument.status, signedDocument.text).toBe(200);
  expect(signedDocument.text).toContain('"stringValue": "signed"');
  expect(signedDocument.text).toContain('"stringValue": "Profesional Sintético"');

  const addendum = await callable<{ documentId: string }>(
    page,
    "appendAddendum",
    professional.idToken,
    {
      ...base,
      signedDocumentId: draftId,
      requestId: `addendum_${suffix}`,
      text: "Aclaración sintética posterior.",
    }
  );
  expect(addendum.status, JSON.stringify(addendum.body)).toBe(200);
  expect(addendum.body.result?.documentId).not.toBe(draftId);
  const originalAfterAddendum = await readDocument(
    page,
    `patients/${patientId}/consultations/${draftId}`,
    professional.idToken
  );
  expect(originalAfterAddendum.text).toBe(signedDocument.text);

  const denied = await callable(page, "createDraftFromAppointment", reception.idToken, {
    ...base,
    appointmentId,
    requestId: `reception_denied_${suffix}`,
  });
  expect(denied.status).toBeGreaterThanOrEqual(400);
  expect(denied.body.error?.status).toBe("PERMISSION_DENIED");
});
