export const RECENT_PATIENTS_LIMIT = 15;

/**
 * Keeps the full client-side portfolio available to the existing search while
 * avoiding an overwhelming default patient list.
 */
export const visiblePatientList = <T>(patients: T[], searchTerm: string): T[] =>
  searchTerm.trim() ? patients : patients.slice(0, RECENT_PATIENTS_LIMIT);
