import {
  PatientPortalAuthorizationError,
  PatientPortalDocumentRepository,
  PatientPortalDocumentService,
  type ConsentAcceptance,
  type PatientPortalGrant,
  type StoredPortalDocument,
  type StoredVersionedConsent,
  sha256Hex,
} from "../patientPortalDocuments";

const NOW = "2026-08-18T12:00:00.000Z";
const TOKEN = "opaque-random-portal-token-0000000000000001";

class Repository implements PatientPortalDocumentRepository {
  grant: PatientPortalGrant | null = {
    id: "grant-1",
    centerId: "center-a",
    patientId: "patient-a",
    tokenHashSha256: sha256Hex(TOKEN),
    permissions: ["documents.read", "consents.read", "consents.accept"],
    expiresAt: "2026-08-19T12:00:00.000Z",
  };
  documents: StoredPortalDocument[] = [];
  consent: StoredVersionedConsent | null = null;
  acceptances: ConsentAcceptance[] = [];

  async findGrantByTokenHash(hash: string) {
    return this.grant?.tokenHashSha256 === hash ? this.grant : null;
  }
  async listDocuments() {
    return this.documents;
  }
  async listConsents() {
    return this.consent ? [this.consent] : [];
  }
  async getConsent() {
    return this.consent;
  }
  async saveConsentAcceptance(acceptance: ConsentAcceptance) {
    this.acceptances.push(acceptance);
  }
}

const tokenCredential = { kind: "token" as const, rawToken: TOKEN };

function publishedConsent(): StoredVersionedConsent {
  const content = "Contenido versión 3";
  return {
    id: "consent-treatment",
    centerId: "center-a",
    title: "Consentimiento de atención",
    version: 3,
    content,
    contentHashSha256: sha256Hex(content),
    publicationStatus: "published",
    publishedAt: "2026-08-17T12:00:00.000Z",
  };
}

describe("patient portal document contract", () => {
  it("returns an allowlisted projection of published documents only", async () => {
    const repository = new Repository();
    repository.documents = [
      {
        id: "published",
        centerId: "center-a",
        patientId: "patient-a",
        title: "Indicaciones de alta",
        documentType: "discharge_instructions",
        publicationStatus: "published",
        publishedAt: "2026-08-18T10:00:00.000Z",
        downloadUrl: "https://storage.invalid/published",
        checksumSha256: "checksum",
        internalNotes: "No debe salir al portal",
        draftContent: { clinicalDraft: "No debe salir" },
      },
      {
        id: "draft",
        centerId: "center-a",
        patientId: "patient-a",
        title: "Nota interna",
        documentType: "progress_note",
        publicationStatus: "draft",
        draftContent: "Borrador clínico",
      },
    ];
    const service = new PatientPortalDocumentService(repository, () => new Date(NOW));

    const result = await service.listPublishedDocuments({
      centerId: "center-a",
      patientId: "patient-a",
      credential: tokenCredential,
    });

    expect(result).toEqual([
      {
        id: "published",
        title: "Indicaciones de alta",
        documentType: "discharge_instructions",
        publishedAt: "2026-08-18T10:00:00.000Z",
        downloadUrl: "https://storage.invalid/published",
        checksumSha256: "checksum",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/internalNotes|clinicalDraft|Borrador/);
  });

  it.each(["expired", "revoked", "wrong-patient", "invalid-expiry"])(
    "denies %s token grants",
    async (mode) => {
      const repository = new Repository();
      if (mode === "expired") repository.grant!.expiresAt = NOW;
      if (mode === "revoked") repository.grant!.revokedAt = "2026-08-18T11:00:00.000Z";
      if (mode === "invalid-expiry") repository.grant!.expiresAt = "not-a-date";
      const service = new PatientPortalDocumentService(repository, () => new Date(NOW));

      await expect(
        service.listPublishedDocuments({
          centerId: "center-a",
          patientId: mode === "wrong-patient" ? "patient-b" : "patient-a",
          credential: tokenCredential,
        })
      ).rejects.toBeInstanceOf(PatientPortalAuthorizationError);
    }
  );

  it("enforces each token permission independently", async () => {
    const repository = new Repository();
    repository.grant!.permissions = ["documents.read"];
    repository.consent = publishedConsent();
    const service = new PatientPortalDocumentService(repository, () => new Date(NOW));

    await expect(
      service.listPublishedDocuments({
        centerId: "center-a",
        patientId: "patient-a",
        credential: tokenCredential,
      })
    ).resolves.toEqual([]);
    await expect(
      service.listPublishedConsents({
        centerId: "center-a",
        patientId: "patient-a",
        credential: tokenCredential,
      })
    ).rejects.toBeInstanceOf(PatientPortalAuthorizationError);
  });

  it("returns only a verified published consent projection", async () => {
    const repository = new Repository();
    repository.consent = {
      ...publishedConsent(),
      internalNotes: "No publicar",
      draftContent: { private: true },
    };
    const service = new PatientPortalDocumentService(repository, () => new Date(NOW));

    const [result] = await service.listPublishedConsents({
      centerId: "center-a",
      patientId: "patient-a",
      credential: tokenCredential,
    });

    expect(result).toEqual({
      id: "consent-treatment",
      title: "Consentimiento de atención",
      version: 3,
      content: "Contenido versión 3",
      contentHashSha256: sha256Hex("Contenido versión 3"),
      publishedAt: "2026-08-17T12:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(/internalNotes|draftContent|No publicar/);
  });

  it("accepts only the exact version and creates an idempotent acceptance id", async () => {
    const repository = new Repository();
    repository.consent = publishedConsent();
    const service = new PatientPortalDocumentService(repository, () => new Date(NOW));

    await expect(
      service.acceptConsent({
        centerId: "center-a",
        patientId: "patient-a",
        consentId: repository.consent.id,
        version: 2,
        contentHashSha256: repository.consent.contentHashSha256,
        accepted: true,
        credential: tokenCredential,
      })
    ).rejects.toBeInstanceOf(PatientPortalAuthorizationError);

    const payload = {
      centerId: "center-a",
      patientId: "patient-a",
      consentId: repository.consent.id,
      version: 3,
      contentHashSha256: repository.consent.contentHashSha256,
      accepted: true as const,
      credential: tokenCredential,
    };
    const first = await service.acceptConsent(payload);
    const retry = await service.acceptConsent(payload);
    expect(first.id).toBe(retry.id);
    expect(first).toMatchObject({
      patientId: "patient-a",
      consentVersion: 3,
      actorUid: null,
      grantId: "grant-1",
    });
  });

  it("rejects tampered or not-yet-published consent content", async () => {
    const repository = new Repository();
    repository.consent = {
      ...publishedConsent(),
      content: "Contenido modificado",
      publishedAt: "2026-08-19T12:00:00.000Z",
    };
    const service = new PatientPortalDocumentService(repository, () => new Date(NOW));

    await expect(
      service.getPublishedConsent({
        centerId: "center-a",
        patientId: "patient-a",
        consentId: repository.consent.id,
        credential: tokenCredential,
      })
    ).rejects.toBeInstanceOf(PatientPortalAuthorizationError);
  });

  it("allows a verified identity only within its patient and center scope", async () => {
    const repository = new Repository();
    const service = new PatientPortalDocumentService(repository, () => new Date(NOW));
    const credential = {
      kind: "identity" as const,
      identity: {
        uid: "patient-user",
        scopes: [
          { centerId: "center-a", patientId: "patient-a" },
          { centerId: "center-b", patientId: "patient-b" },
        ],
      },
    };

    await expect(
      service.listPublishedDocuments({ centerId: "center-a", patientId: "patient-a", credential })
    ).resolves.toEqual([]);
    await expect(
      service.listPublishedDocuments({ centerId: "center-a", patientId: "patient-b", credential })
    ).rejects.toBeInstanceOf(PatientPortalAuthorizationError);
  });
});
