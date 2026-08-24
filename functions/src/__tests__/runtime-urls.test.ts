import { resolveRuntimePublicAppUrl } from "../runtimeUrls";

describe("runtime public application URL", () => {
  it("derives the URL from the executing Firebase project", () => {
    expect(resolveRuntimePublicAppUrl({ projectId: "clavesalud-staging-test" })).toBe(
      "https://clavesalud-staging-test.web.app"
    );
  });

  it("allows an explicit environment URL without trailing slash", () => {
    expect(
      resolveRuntimePublicAppUrl({
        projectId: "ignored-project",
        configuredUrl: "https://staging.example.test///",
      })
    ).toBe("https://staging.example.test");
  });

  it("fails closed without a project or configured URL", () => {
    expect(() => resolveRuntimePublicAppUrl({})).toThrow("PUBLIC_APP_URL_UNAVAILABLE");
  });
});
