import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuditLogViewer from "../AuditLogViewer";

vi.mock("../../firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ docs: [] })),
    limit: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
  };
});

describe("AuditLogViewer privacy", () => {
  it("keeps inspection read-only while no audited export backend exists", async () => {
    render(<AuditLogViewer centerId="center-a" staff={[]} patients={[]} />);

    expect(screen.getByRole("button", { name: /recargar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /exportar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/exportar csv/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/auditoría de seguridad/i)).toBeInTheDocument());
  });
});
