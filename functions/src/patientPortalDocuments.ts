import * as crypto from "crypto";

export type PatientPortalPermission = "documents.read" | "consents.read" | "consents.accept";

export interface PatientPortalGrant {
  id: string;
  centerId: string;
  patientId: string;
  tokenHashSha256: string;
  permissions: PatientPortalPermission[];
  expiresAt: string;
  revokedAt?: string | null;
}

export interface VerifiedPatientIdentity {
  uid: string;
  centerIds: string[];
  patientIds: string[];
}

export type PatientPortalCredential =
  | { kind: "token"; rawToken: string }
  | { kind: "identity"; identity: VerifiedPatientIdentity };

export interface StoredPortalDocument {
  id: string;
  centerId: string;
  patientId: string;
  title: string;
  documentType: string;
  publicationStatus: "draft" | "published" | "revoked";
  publishedAt?: string | null;
  downloadUrl?: string | null;
  checksumSha256?: string | null;
  internalNotes?: string | null;
  draftContent?: unknown;
}

export interface PublishedPortalDocument {
  id: string;
  title: string;
  documentType: string;
  publishedAt: string;
  downloadUrl: string | null;
  checksumSha256: string | null;
}

export interface StoredVersionedConsent {
  id: string;
  centerId: string;
  title: string;
  version: number;
  content: string;
  contentHashSha256: string;
  publicationStatus: "draft" | "published" | "retired";
  publishedAt?: string | null;
  internalNotes?: string | null;
  draftContent?: unknown;
}

export interface PublishedVersionedConsent {
  id: string;
  title: string;
  version: number;
  content: string;
  contentHashSha256: string;
  publishedAt: string;
}

export interface ConsentAcceptance {
  id: string;
  centerId: string;
  patientId: string;
  consentId: string;
  consentVersion: number;
  consentContentHashSha256: string;
  acceptedAt: string;
  actorUid: string | null;
  grantId: string | null;
}

export interface PatientPortalDocumentRepository {
  findGrantByTokenHash(tokenHashSha256: string): Promise<PatientPortalGrant | null>;
  listDocuments(centerId: string, patientId: string): Promise<StoredPortalDocument[]>;
  listConsents(centerId: string): Promise<StoredVersionedConsent[]>;
  getConsent(centerId: string, consentId: string): Promise<StoredVersionedConsent | null>;
  saveConsentAcceptance(acceptance: ConsentAcceptance): Promise<void>;
}

interface AuthorizedPortalScope {
  actorUid: string | null;
  grantId: string | null;
}

export class PatientPortalAuthorizationError extends Error {
  constructor() {
    super("PATIENT_PORTAL_ACCESS_DENIED");
    this.name = "PatientPortalAuthorizationError";
  }
}

export class PatientPortalDocumentService {
  constructor(
    private readonly repository: PatientPortalDocumentRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async listPublishedDocuments(params: {
    centerId: string;
    patientId: string;
    credential: PatientPortalCredential;
  }): Promise<PublishedPortalDocument[]> {
    await this.authorize(params, "documents.read");
    const nowMs = this.now().getTime();
    const documents = await this.repository.listDocuments(params.centerId, params.patientId);

    return documents
      .filter((document) => {
        const publishedAtMs = Date.parse(String(document.publishedAt || ""));
        return (
          document.centerId === params.centerId &&
          document.patientId === params.patientId &&
          document.publicationStatus === "published" &&
          Number.isFinite(publishedAtMs) &&
          publishedAtMs <= nowMs
        );
      })
      .map((document) => ({
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        publishedAt: String(document.publishedAt),
        downloadUrl: document.downloadUrl || null,
        checksumSha256: document.checksumSha256 || null,
      }));
  }

  async listPublishedConsents(params: {
    centerId: string;
    patientId: string;
    credential: PatientPortalCredential;
  }): Promise<PublishedVersionedConsent[]> {
    await this.authorize(params, "consents.read");
    const nowMs = this.now().getTime();
    const consents = await this.repository.listConsents(params.centerId);

    return consents
      .filter((consent) => this.isPublishedConsent(consent, params.centerId, nowMs))
      .map(toPublishedConsent);
  }

  async getPublishedConsent(params: {
    centerId: string;
    patientId: string;
    consentId: string;
    credential: PatientPortalCredential;
  }): Promise<PublishedVersionedConsent> {
    await this.authorize(params, "consents.read");
    const consent = await this.repository.getConsent(params.centerId, params.consentId);
    if (!consent || !this.isPublishedConsent(consent, params.centerId, this.now().getTime())) {
      throw new PatientPortalAuthorizationError();
    }
    return toPublishedConsent(consent);
  }

  async acceptConsent(params: {
    centerId: string;
    patientId: string;
    consentId: string;
    version: number;
    contentHashSha256: string;
    accepted: true;
    credential: PatientPortalCredential;
  }): Promise<ConsentAcceptance> {
    const scope = await this.authorize(params, "consents.accept");
    const consent = await this.getPublishedConsent(params);
    if (
      params.accepted !== true ||
      consent.version !== params.version ||
      consent.contentHashSha256 !== params.contentHashSha256
    ) {
      throw new PatientPortalAuthorizationError();
    }

    const acceptance: ConsentAcceptance = {
      id: consentAcceptanceId({ ...params, ...scope }),
      centerId: params.centerId,
      patientId: params.patientId,
      consentId: consent.id,
      consentVersion: consent.version,
      consentContentHashSha256: consent.contentHashSha256,
      acceptedAt: this.now().toISOString(),
      actorUid: scope.actorUid,
      grantId: scope.grantId,
    };
    await this.repository.saveConsentAcceptance(acceptance);
    return acceptance;
  }

  private isPublishedConsent(
    consent: StoredVersionedConsent,
    centerId: string,
    nowMs: number
  ): boolean {
    const publishedAtMs = Date.parse(String(consent.publishedAt || ""));
    return (
      consent.centerId === centerId &&
      consent.publicationStatus === "published" &&
      Number.isInteger(consent.version) &&
      consent.version > 0 &&
      Number.isFinite(publishedAtMs) &&
      publishedAtMs <= nowMs &&
      /^[a-f0-9]{64}$/i.test(consent.contentHashSha256) &&
      sha256Hex(consent.content) === consent.contentHashSha256.toLowerCase()
    );
  }

  private async authorize(
    params: { centerId: string; patientId: string; credential: PatientPortalCredential },
    permission: PatientPortalPermission
  ): Promise<AuthorizedPortalScope> {
    if (!params.centerId.trim() || !params.patientId.trim()) {
      throw new PatientPortalAuthorizationError();
    }

    if (params.credential.kind === "identity") {
      const { identity } = params.credential;
      if (
        identity.uid.trim() &&
        identity.centerIds.includes(params.centerId) &&
        identity.patientIds.includes(params.patientId)
      ) {
        return { actorUid: identity.uid, grantId: null };
      }
      throw new PatientPortalAuthorizationError();
    }

    const token = params.credential.rawToken.trim();
    if (token.length < 32 || token.includes(params.patientId) || token.includes(params.centerId)) {
      throw new PatientPortalAuthorizationError();
    }
    const grant = await this.repository.findGrantByTokenHash(sha256Hex(token));
    const expiresAtMs = Date.parse(String(grant?.expiresAt || ""));
    if (
      !grant ||
      grant.centerId !== params.centerId ||
      grant.patientId !== params.patientId ||
      Boolean(grant.revokedAt) ||
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs <= this.now().getTime() ||
      !grant.permissions.includes(permission)
    ) {
      throw new PatientPortalAuthorizationError();
    }
    return { actorUid: null, grantId: grant.id };
  }
}

function toPublishedConsent(consent: StoredVersionedConsent): PublishedVersionedConsent {
  return {
    id: consent.id,
    title: consent.title,
    version: consent.version,
    content: consent.content,
    contentHashSha256: consent.contentHashSha256,
    publishedAt: String(consent.publishedAt),
  };
}

function consentAcceptanceId(params: {
  centerId: string;
  patientId: string;
  consentId: string;
  version: number;
  contentHashSha256: string;
  actorUid: string | null;
  grantId: string | null;
}): string {
  return `acceptance_${sha256Hex(
    [
      params.centerId,
      params.patientId,
      params.consentId,
      String(params.version),
      params.contentHashSha256,
      params.actorUid || "",
      params.grantId || "",
    ].join("\u001f")
  ).slice(0, 48)}`;
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
