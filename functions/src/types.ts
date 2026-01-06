export type InviteStatus = "pending" | "claimed" | "revoked";

export interface InviteDoc {
  emailLower: string;
  email?: string;
  centerId: string;
  role: string; // guardamos raw; el cliente normaliza si quiere
  status: InviteStatus;

  createdAt?: any;
  createdByUid?: string;

  expiresAt?: any;

  claimedAt?: any;
  claimedByUid?: string;

  professionalId?: string;
}

export interface ClaimInviteResult {
  ok: true;
  centerId: string;
  role: string;
}
