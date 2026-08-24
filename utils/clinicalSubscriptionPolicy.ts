export const canSubscribeToClinicalPatients = (
  authenticatedUid: string | undefined,
  isSuperAdminClaim: boolean
): boolean => Boolean(authenticatedUid) && !isSuperAdminClaim;
