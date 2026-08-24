const stripTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, "");

export function resolveRuntimePublicAppUrl(params: {
  projectId?: string;
  configuredUrl?: string;
}): string {
  const configuredUrl = stripTrailingSlash(params.configuredUrl || "");
  if (configuredUrl) return configuredUrl;

  const projectId = (params.projectId || "").trim();
  if (!projectId) throw new Error("PUBLIC_APP_URL_UNAVAILABLE");
  return `https://${projectId}.web.app`;
}
