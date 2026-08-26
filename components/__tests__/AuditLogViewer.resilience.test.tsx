import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuditLogViewer from "../AuditLogViewer";

vi.mock("../../firebase", () => ({ db: null }));

describe("AuditLogViewer resilience", () => {
  it("renders a safe empty state when directory context is unavailable", () => {
    render(<AuditLogViewer centerId="center-a" />);

    expect(screen.getByRole("button", { name: /recargar/i })).toBeInTheDocument();
    expect(screen.getByText(/no hay registros para estos filtros/i)).toBeInTheDocument();
  });
});
