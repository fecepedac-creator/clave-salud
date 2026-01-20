import { createContext } from "react";
import type { MedicalCenter } from "./types";

// -------------------- Center / Modules Context --------------------
// Permite que cualquier componente (AdminDashboard, DoctorDashboard, etc.) pueda leer:
// - centro activo
// - configuración de módulos (centers/{id}.modules)

export type CenterModules = Record<string, boolean>;

export const CenterContext = createContext<{
  activeCenterId: string;
  activeCenter: MedicalCenter | null;
  modules: CenterModules;
  setActiveCenterId: (id: string) => void;
  updateModules: (modules: CenterModules) => void;
  isModuleEnabled: (key: string) => boolean;
}>({
  activeCenterId: "",
  activeCenter: null,
  modules: {},
  setActiveCenterId: () => {},
  updateModules: () => {},
  isModuleEnabled: () => false,
});
