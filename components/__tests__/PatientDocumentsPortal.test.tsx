import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatientDocumentsPortal from "../PatientDocumentsPortal";

const callable = vi.fn();
const authStateChanged = vi.fn();

vi.mock("../../firebase", () => ({ auth: {}, functions: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => authStateChanged(...args),
}));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) => (payload: unknown) =>
    callable(name, payload),
}));

describe("PatientDocumentsPortal", () => {
  beforeEach(() => {
    callable.mockReset();
    authStateChanged.mockReset();
    authStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return () => undefined;
    });
    window.history.replaceState({}, "", "/center/center-a/mi-clavesalud");
    callable.mockImplementation(async (name: string) => {
      if (name === "listPublishedPatientDocuments") {
        return {
          data: {
            documents: [
              {
                id: "document-1",
                title: "Indicaciones publicadas",
                documentType: "instructions",
                publishedAt: "2026-08-18T10:00:00.000Z",
                downloadUrl: "https://example.invalid/document",
                checksumSha256: "checksum",
              },
            ],
          },
        };
      }
      if (name === "listPublishedPatientConsents") {
        return {
          data: {
            consents: [
              {
                id: "consent-1",
                title: "Consentimiento informado",
                version: 4,
                content: "Contenido publicado del consentimiento.",
                contentHashSha256: "a".repeat(64),
                publishedAt: "2026-08-18T09:00:00.000Z",
              },
            ],
          },
        };
      }
      return { data: { accepted: true, acceptedAt: "2026-08-18T12:30:00.000Z" } };
    });
  });

  it("keeps private content out of the public portal without verified access", async () => {
    render(<PatientDocumentsPortal centerId="center-a" onBack={vi.fn()} />);

    await screen.findByText("Acceso personal requerido");
    expect(screen.queryByText("Mi ClaveSalud")).not.toBeInTheDocument();
    expect(screen.queryByText("Documentos y consentimientos")).not.toBeInTheDocument();
    expect(callable).not.toHaveBeenCalled();
  });

  it("loads the private module for an authenticated patient session", async () => {
    authStateChanged.mockImplementation((_auth, callback) => {
      callback({ uid: "patient-user" });
      return () => undefined;
    });

    render(<PatientDocumentsPortal centerId="center-a" onBack={vi.fn()} />);

    await screen.findByText("Documentos y consentimientos");
    expect(screen.getByText("Indicaciones publicadas")).toBeInTheDocument();
    expect(callable).toHaveBeenCalledTimes(2);
    for (const [, payload] of callable.mock.calls) {
      expect(payload).toEqual({ centerId: "center-a" });
      expect(payload).not.toHaveProperty("patientId");
      expect(payload).not.toHaveProperty("token");
    }
  });

  it("consumes a fragment token, sanitizes the URL and never persists it", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    window.history.replaceState(
      {},
      "",
      `/center/center-a/mi-clavesalud?keep=1#portalToken=${"opaque-url-token-00000000000000000001"}&source=mail`
    );

    render(<PatientDocumentsPortal centerId="center-a" onBack={vi.fn()} />);

    await screen.findByText("Indicaciones publicadas");
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#source=mail");
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(callable).toHaveBeenCalledTimes(2);
    for (const [, payload] of callable.mock.calls) {
      expect(payload).toMatchObject({
        centerId: "center-a",
        token: "opaque-url-token-00000000000000000001",
      });
      expect(payload).not.toHaveProperty("patientId");
    }
    localStorageSpy.mockRestore();
  });

  it("requires explicit confirmation and sends the exact published version", async () => {
    window.history.replaceState(
      {},
      "",
      "/center/center-a/mi-clavesalud#portalToken=opaque-url-token-00000000000000000002"
    );
    render(<PatientDocumentsPortal centerId="center-a" onBack={vi.fn()} />);

    await screen.findByText(/Versión 4/);
    expect(screen.getByText(`Verificación: ${"a".repeat(64)}`)).toBeInTheDocument();
    const acceptButton = screen.getByRole("button", { name: "Aceptar versión 4" });
    expect(acceptButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Confirmo que leí esta versión completa y deseo aceptarla.",
      })
    );
    fireEvent.click(acceptButton);

    await waitFor(() => expect(screen.getByText(/Aceptado correctamente/)).toBeInTheDocument());
    const acceptanceCall = callable.mock.calls.find(
      ([name]) => name === "acceptPublishedPatientConsent"
    );
    expect(acceptanceCall?.[1]).toMatchObject({
      centerId: "center-a",
      consentId: "consent-1",
      version: 4,
      contentHashSha256: "a".repeat(64),
      accepted: true,
    });
    expect(acceptanceCall?.[1]).not.toHaveProperty("patientId");
  });

  it("never renders a non-HTTPS document link", async () => {
    window.history.replaceState(
      {},
      "",
      "/center/center-a/mi-clavesalud#portalToken=opaque-url-token-00000000000000000003"
    );
    callable.mockImplementation(async (name: string) => {
      if (name === "listPublishedPatientDocuments") {
        return {
          data: {
            documents: [
              {
                id: "unsafe",
                title: "Documento sin enlace seguro",
                documentType: "instructions",
                publishedAt: "2026-08-18T10:00:00.000Z",
                downloadUrl: "javascript:alert(1)",
                checksumSha256: null,
              },
            ],
          },
        };
      }
      return { data: { consents: [] } };
    });

    render(<PatientDocumentsPortal centerId="center-a" onBack={vi.fn()} />);

    await screen.findByText("Documento sin enlace seguro");
    expect(screen.queryByRole("link", { name: "Abrir documento" })).not.toBeInTheDocument();
  });
});
