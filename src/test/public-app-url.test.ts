import { describe, expect, it } from "vitest";
import { resolveFunctionsHttpUrl, resolvePublicAppUrl } from "../../utils/publicAppUrl";

describe("public environment URLs", () => {
  it("prefers the configured environment URL and removes trailing slashes", () => {
    expect(
      resolvePublicAppUrl(
        "https://clavesalud-staging-test.web.app///",
        "https://clavesalud-2.web.app"
      )
    ).toBe("https://clavesalud-staging-test.web.app");
  });

  it("uses the current origin when no environment URL is configured", () => {
    expect(resolvePublicAppUrl(undefined, "http://127.0.0.1:5175/")).toBe("http://127.0.0.1:5175");
  });

  it("builds a Functions URL only from the active project", () => {
    expect(
      resolveFunctionsHttpUrl({
        projectId: "clavesalud-staging-test",
        functionName: "whatsappWebhook",
      })
    ).toBe("https://us-central1-clavesalud-staging-test.cloudfunctions.net/whatsappWebhook");
    expect(resolveFunctionsHttpUrl({ projectId: "", functionName: "whatsappWebhook" })).toBe("");
  });
});
