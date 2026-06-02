const envFlag = (name: string, defaultValue = false) => {
  const value = (import.meta as any)?.env?.[name];
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === "true";
};

export const PILOT_FEATURES = {
  advancedWhatsapp: envFlag("VITE_ENABLE_ADVANCED_WHATSAPP"),
  aiUsage: envFlag("VITE_ENABLE_AI_USAGE"),
  campaigns: envFlag("VITE_ENABLE_CAMPAIGNS"),
  marketing: envFlag("VITE_ENABLE_MARKETING"),
  manualClinicalBackup: envFlag("VITE_ENABLE_MANUAL_CLINICAL_BACKUP"),
  browserClinicalMigration: envFlag("VITE_ENABLE_BROWSER_CLINICAL_MIGRATION"),
} as const;
