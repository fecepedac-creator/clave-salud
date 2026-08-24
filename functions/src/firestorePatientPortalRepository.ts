import { FieldValue, db } from "./firebaseAdmin";
import {
  type ConsentAcceptance,
  type PatientPortalDocumentRepository,
  type PatientPortalGrant,
  type StoredPortalDocument,
  type StoredVersionedConsent,
  type VerifiedPatientIdentity,
} from "./patientPortalDocuments";

function isoString(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

export class FirestorePatientPortalRepository implements PatientPortalDocumentRepository {
  async findGrantByTokenHash(tokenHashSha256: string): Promise<PatientPortalGrant | null> {
    const snapshot = await db
      .collectionGroup("patientPortalGrants")
      .where("tokenHashSha256", "==", tokenHashSha256)
      .limit(2)
      .get();
    if (snapshot.size !== 1) return null;

    const document = snapshot.docs[0];
    const data = document.data();
    const centerIdFromPath = document.ref.parent.parent?.id || "";
    return {
      id: document.id,
      centerId: centerIdFromPath,
      patientId: String(data.patientId || ""),
      tokenHashSha256: String(data.tokenHashSha256 || ""),
      permissions: Array.isArray(data.permissions) ? data.permissions.map(String) : [],
      expiresAt: isoString(data.expiresAt),
      revokedAt: data.revokedAt ? isoString(data.revokedAt) : null,
    } as PatientPortalGrant;
  }

  async listDocuments(centerId: string, patientId: string): Promise<StoredPortalDocument[]> {
    const snapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("patients")
      .doc(patientId)
      .collection("portalDocuments")
      .where("publicationStatus", "==", "published")
      .get();
    return snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        centerId,
        patientId,
        title: String(data.title || ""),
        documentType: String(data.documentType || ""),
        publicationStatus: String(
          data.publicationStatus
        ) as StoredPortalDocument["publicationStatus"],
        publishedAt: isoString(data.publishedAt),
        downloadUrl: typeof data.downloadUrl === "string" ? data.downloadUrl : null,
        checksumSha256: typeof data.checksumSha256 === "string" ? data.checksumSha256 : null,
        internalNotes: typeof data.internalNotes === "string" ? data.internalNotes : null,
        draftContent: data.draftContent,
      };
    });
  }

  async listConsents(centerId: string): Promise<StoredVersionedConsent[]> {
    const snapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("portalConsents")
      .where("publicationStatus", "==", "published")
      .get();
    return snapshot.docs.map((document) => this.consentFromSnapshot(centerId, document));
  }

  async getConsent(centerId: string, consentId: string): Promise<StoredVersionedConsent | null> {
    const snapshot = await db
      .collection("centers")
      .doc(centerId)
      .collection("portalConsents")
      .doc(consentId)
      .get();
    return snapshot.exists ? this.consentFromSnapshot(centerId, snapshot) : null;
  }

  async saveConsentAcceptance(acceptance: ConsentAcceptance): Promise<void> {
    const centerRef = db.collection("centers").doc(acceptance.centerId);
    const acceptanceRef = centerRef
      .collection("patients")
      .doc(acceptance.patientId)
      .collection("consentAcceptances")
      .doc(acceptance.id);
    const auditRef = centerRef.collection("auditLogs").doc(`portal_${acceptance.id}`);

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(acceptanceRef);
      if (existing.exists) {
        const data = existing.data() || {};
        const sameAcceptance =
          data.consentId === acceptance.consentId &&
          data.consentVersion === acceptance.consentVersion &&
          data.consentContentHashSha256 === acceptance.consentContentHashSha256 &&
          (data.actorUid || null) === acceptance.actorUid &&
          (data.grantId || null) === acceptance.grantId;
        if (!sameAcceptance) throw new Error("CONSENT_ACCEPTANCE_CONFLICT");
        return;
      }

      transaction.create(acceptanceRef, {
        ...acceptance,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        type: "ACTION",
        action: "PORTAL_CONSENT_ACCEPTED",
        entityType: "consentAcceptance",
        entityId: acceptance.id,
        patientId: acceptance.patientId,
        actorUid: acceptance.actorUid || `portal-grant:${acceptance.grantId || "unknown"}`,
        actorRole: "patient_portal",
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          consentId: acceptance.consentId,
          consentVersion: acceptance.consentVersion,
          consentContentHashSha256: acceptance.consentContentHashSha256,
          source: "patient_portal_callable",
          immutable: true,
        },
      });
    });
  }

  async resolveVerifiedIdentity(uid: string): Promise<VerifiedPatientIdentity | null> {
    const snapshot = await db.collection("patientPortalIdentities").doc(uid).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() || {};
    const scopes = Array.isArray(data.scopes)
      ? data.scopes
          .map((scope: unknown) => {
            if (!scope || typeof scope !== "object") return null;
            const value = scope as Record<string, unknown>;
            const centerId = String(value.centerId || "").trim();
            const patientId = String(value.patientId || "").trim();
            return centerId && patientId ? { centerId, patientId } : null;
          })
          .filter((scope): scope is { centerId: string; patientId: string } => Boolean(scope))
      : [];
    return { uid, scopes };
  }

  private consentFromSnapshot(
    centerId: string,
    snapshot: FirebaseFirestore.DocumentSnapshot
  ): StoredVersionedConsent {
    const data = snapshot.data() || {};
    return {
      id: snapshot.id,
      centerId,
      title: String(data.title || ""),
      version: Number(data.version || 0),
      content: String(data.content || ""),
      contentHashSha256: String(data.contentHashSha256 || "").toLowerCase(),
      publicationStatus: String(
        data.publicationStatus || "draft"
      ) as StoredVersionedConsent["publicationStatus"],
      publishedAt: isoString(data.publishedAt),
      internalNotes: typeof data.internalNotes === "string" ? data.internalNotes : null,
      draftContent: data.draftContent,
    };
  }
}
