import { db } from "../firebaseAdmin";
import { FirestorePatientPortalRepository } from "../firestorePatientPortalRepository";
import { PatientPortalDocumentService, sha256Hex } from "../patientPortalDocuments";

jest.setTimeout(30_000);

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator("patient portal Firestore repository", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const centerId = `portal-center-${suffix}`;
  const patientId = `portal-patient-${suffix}`;
  const token = `opaque-emulator-token-${suffix}-0000000000000000`;
  const centerRef = db.collection("centers").doc(centerId);
  const identityRef = db.collection("patientPortalIdentities").doc(`uid-${suffix}`);

  afterAll(async () => {
    await Promise.all([db.recursiveDelete(centerRef), identityRef.delete()]);
  });

  it("filters unpublished material and atomically audits one idempotent acceptance", async () => {
    await centerRef
      .collection("patientPortalGrants")
      .doc("grant")
      .set({
        patientId,
        tokenHashSha256: sha256Hex(token),
        permissions: ["documents.read", "consents.read", "consents.accept"],
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        revokedAt: null,
      });
    await identityRef.set({ scopes: [{ centerId, patientId }] });

    const documentsRef = centerRef
      .collection("patients")
      .doc(patientId)
      .collection("portalDocuments");
    await Promise.all([
      documentsRef.doc("published").set({
        title: "Documento publicado",
        documentType: "instructions",
        publicationStatus: "published",
        publishedAt: new Date("2026-08-18T10:00:00.000Z"),
        internalNotes: "no exponer",
      }),
      documentsRef.doc("draft").set({
        title: "Borrador",
        documentType: "internal_note",
        publicationStatus: "draft",
        draftContent: "no exponer",
      }),
    ]);
    const content = "Consentimiento productivo versión 1";
    const contentHashSha256 = sha256Hex(content);
    await centerRef
      .collection("portalConsents")
      .doc("consent-1")
      .set({
        title: "Consentimiento",
        version: 1,
        content,
        contentHashSha256,
        publicationStatus: "published",
        publishedAt: new Date("2026-08-18T10:00:00.000Z"),
        internalNotes: "no exponer",
      });

    const repository = new FirestorePatientPortalRepository();
    const service = new PatientPortalDocumentService(
      repository,
      () => new Date("2026-08-18T12:00:00.000Z")
    );
    const credential = { kind: "token" as const, rawToken: token };

    const identity = await repository.resolveVerifiedIdentity(identityRef.id);
    expect(identity).toEqual({ uid: identityRef.id, scopes: [{ centerId, patientId }] });

    const documents = await service.listPublishedDocuments({ centerId, patientId, credential });
    expect(documents).toHaveLength(1);
    expect(JSON.stringify(documents)).not.toMatch(/no exponer|Borrador/);

    const payload = {
      centerId,
      patientId,
      consentId: "consent-1",
      version: 1,
      contentHashSha256,
      accepted: true as const,
      credential,
    };
    const first = await service.acceptConsent(payload);
    const retry = await service.acceptConsent(payload);
    expect(retry.id).toBe(first.id);

    const [acceptances, audits] = await Promise.all([
      centerRef.collection("patients").doc(patientId).collection("consentAcceptances").get(),
      centerRef.collection("auditLogs").where("entityId", "==", first.id).get(),
    ]);
    expect(acceptances.size).toBe(1);
    expect(acceptances.docs[0].data()).toMatchObject({ consentVersion: 1, grantId: "grant" });
    expect(audits.size).toBe(1);
    expect(audits.docs[0].data()).toMatchObject({
      action: "PORTAL_CONSENT_ACCEPTED",
      patientId,
    });
  });
});
