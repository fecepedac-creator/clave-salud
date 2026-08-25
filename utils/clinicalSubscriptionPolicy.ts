export const canSubscribeToClinicalPatients = (
  authenticatedUid: string | undefined,
  _isSuperAdminClaim: boolean
): boolean => {
  // A global-admin claim must not by itself grant a clinical read. That
  // decision belongs to Firestore Rules, which still require the caller to be
  // assigned to the patient's care team or to hold an active clinical role in
  // the center. Blocking the query here also blocks clinicians who legitimately
  // carry a superadmin claim for platform administration.
  return Boolean(authenticatedUid);
};
