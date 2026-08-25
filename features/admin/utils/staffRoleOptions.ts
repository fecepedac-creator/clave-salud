import { ClinicalProfession } from "../../../types";
import { isCreatableCenterStaffRole, normalizeClinicalProfession } from "../../../utils/roles";

export interface ClinicalRoleOption {
  id: ClinicalProfession;
  label: string;
}

export function getCreatableClinicalRoleOptions(
  labels: Record<string, string>
): ClinicalRoleOption[] {
  return Object.entries(labels)
    .filter(
      ([role]) => isCreatableCenterStaffRole(role) && normalizeClinicalProfession(role) !== null
    )
    .map(([role, label]) => ({ id: role as ClinicalProfession, label }));
}
