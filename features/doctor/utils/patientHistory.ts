type LegacyHistoryEntry =
  | string
  | {
      code?: unknown;
      display?: unknown;
    }
  | null
  | undefined;

export const getHistoryDisplay = (entry: LegacyHistoryEntry): string => {
  if (typeof entry === "string") return entry;
  return typeof entry?.display === "string" ? entry.display : "";
};

export const getHistoryCode = (entry: LegacyHistoryEntry): string => {
  if (typeof entry === "string") return "";
  return typeof entry?.code === "string" ? entry.code : "";
};
