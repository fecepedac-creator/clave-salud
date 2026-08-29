import * as functions from "firebase-functions/v1";
import { z } from "zod";
import { FieldValue, Timestamp, db } from "./firebaseAdmin";
import { FirestorePatientPortalRepository } from "./firestorePatientPortalRepository";
import {
  PatientPortalAuthorizationError,
  PatientPortalDocumentService,
  type PatientPortalCredential,
  sha256Hex,
} from "./patientPortalDocuments";
import { consumeFixedWindowRateLimit, hashPublicRateLimitKey } from "./publicAppointmentProtection";

const PortalScopeSchema = z.object({
  centerId: z.string().trim().min(1).max(128),
  token: z.string().trim().min(32).max(512).optional(),
});

const PortalConsentSchema = PortalScopeSchema.extend({
  consentId: z.string().trim().min(1).max(128),
  version: z.number().int().positive(),
  contentHashSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  accepted: z.literal(true),
});

type CallableContext = {
  auth?: { uid?: string } | null;
  rawRequest?: { ip?: string };
};

const repository = new FirestorePatientPortalRepository();
const service = new PatientPortalDocumentService(repository);

async function credentialFor(
  context: CallableContext,
  token?: string
): Promise<PatientPortalCredential> {
  if (token) return { kind: "token", rawToken: token };
  const uid = String(context.auth?.uid || "").trim();
  if (!uid) throw new PatientPortalAuthorizationError();
  const identity = await repository.resolveVerifiedIdentity(uid);
  if (!identity) throw new PatientPortalAuthorizationError();
  return { kind: "identity", identity };
}

async function resolvePatientScope(params: {
  centerId: string;
  token?: string;
  context: CallableContext;
}): Promise<{ patientId: string; credential: PatientPortalCredential }> {
  const credential = await credentialFor(params.context, params.token);
  if (credential.kind === "token") {
    const grant = await repository.findGrantByTokenHash(sha256Hex(credential.rawToken));
    if (!grant || grant.centerId !== params.centerId) {
      throw new PatientPortalAuthorizationError();
    }
    return { patientId: grant.patientId, credential };
  }

  const matchingScopes = credential.identity.scopes.filter(
    (scope) => scope.centerId === params.centerId
  );
  if (matchingScopes.length !== 1) throw new PatientPortalAuthorizationError();
  return { patientId: matchingScopes[0].patientId, credential };
}

async function enforcePortalRateLimit(params: {
  operation: string;
  centerId: string;
  token?: string;
  context: CallableContext;
}): Promise<void> {
  const nowMs = Date.now();
  const subject = params.token
    ? `token:${sha256Hex(params.token)}`
    : `uid:${params.context.auth?.uid || "missing"}`;
  const network = String(params.context.rawRequest?.ip || "unknown");
  const keys = [
    { value: subject, limit: 30 },
    { value: `network:${network}`, limit: 60 },
  ];
  const refs = keys.map(({ value }) =>
    db
      .collection("_publicCallableRateLimits")
      .doc(hashPublicRateLimitKey(["patientPortal", params.operation, params.centerId, value]))
  );

  const allowed = await db.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((reference) => transaction.get(reference)));
    const decisions = snapshots.map((snapshot, index) => {
      const data = snapshot.data();
      return consumeFixedWindowRateLimit({
        current: data
          ? {
              count: Number(data.count || 0),
              windowStartedAtMs:
                data.windowStartedAt?.toMillis?.() ?? Number(data.windowStartedAtMs || 0),
            }
          : null,
        nowMs,
        windowMs: 15 * 60 * 1000,
        limit: keys[index].limit,
      });
    });
    decisions.forEach((decision, index) => {
      transaction.set(refs[index], {
        count: decision.next.count,
        windowStartedAt: Timestamp.fromMillis(decision.next.windowStartedAtMs),
        expiresAt: Timestamp.fromMillis(decision.next.windowStartedAtMs + 30 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return decisions.every((decision) => decision.allowed);
  });

  if (!allowed) throw new PatientPortalAuthorizationError();
}

function portalError(error: unknown): never {
  if (!(error instanceof PatientPortalAuthorizationError)) {
    functions.logger.warn("Patient portal request denied", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
  throw new functions.https.HttpsError(
    "permission-denied",
    "No fue posible acceder al contenido solicitado."
  );
}

export const listPublishedPatientDocuments = functions.https.onCall(async (data, context) => {
  try {
    const input = PortalScopeSchema.parse(data || {});
    await enforcePortalRateLimit({
      operation: "documents",
      centerId: input.centerId,
      token: input.token,
      context,
    });
    const scope = await resolvePatientScope({
      centerId: input.centerId,
      token: input.token,
      context,
    });
    return {
      documents: await service.listPublishedDocuments({
        centerId: input.centerId,
        patientId: scope.patientId,
        credential: scope.credential,
      }),
    };
  } catch (error) {
    return portalError(error);
  }
});

export const listPublishedPatientConsents = functions.https.onCall(async (data, context) => {
  try {
    const input = PortalScopeSchema.parse(data || {});
    await enforcePortalRateLimit({
      operation: "consents",
      centerId: input.centerId,
      token: input.token,
      context,
    });
    const scope = await resolvePatientScope({
      centerId: input.centerId,
      token: input.token,
      context,
    });
    return {
      consents: await service.listPublishedConsents({
        centerId: input.centerId,
        patientId: scope.patientId,
        credential: scope.credential,
      }),
    };
  } catch (error) {
    return portalError(error);
  }
});

export const acceptPublishedPatientConsent = functions.https.onCall(async (data, context) => {
  try {
    const input = PortalConsentSchema.parse(data || {});
    await enforcePortalRateLimit({
      operation: "acceptConsent",
      centerId: input.centerId,
      token: input.token,
      context,
    });
    const scope = await resolvePatientScope({
      centerId: input.centerId,
      token: input.token,
      context,
    });
    const acceptance = await service.acceptConsent({
      ...input,
      contentHashSha256: input.contentHashSha256.toLowerCase(),
      patientId: scope.patientId,
      credential: scope.credential,
    });
    return {
      accepted: true,
      acceptanceId: acceptance.id,
      acceptedAt: acceptance.acceptedAt,
      consentVersion: acceptance.consentVersion,
    };
  } catch (error) {
    return portalError(error);
  }
});
