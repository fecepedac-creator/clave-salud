const trimTrailingSlash = (value: string) => value.trim().replace(/\/+$/, "");

export function resolvePublicAppUrl(configuredUrl?: string, runtimeOrigin?: string): string {
  const configured = trimTrailingSlash(configuredUrl || "");
  if (configured) return configured;
  return trimTrailingSlash(runtimeOrigin || "");
}

export function getPublicAppUrl(): string {
  const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
  return resolvePublicAppUrl(import.meta.env.VITE_PUBLIC_APP_URL, runtimeOrigin);
}

export function resolveFunctionsHttpUrl(params: {
  projectId?: string;
  functionName: string;
  region?: string;
}): string {
  const projectId = (params.projectId || "").trim();
  const functionName = params.functionName.trim();
  const region = (params.region || "us-central1").trim();
  if (!projectId || !functionName || !region) return "";
  return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

export function getFunctionsHttpUrl(functionName: string, region = "us-central1"): string {
  return resolveFunctionsHttpUrl({
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    functionName,
    region,
  });
}
