import { describe, expect, it } from "vitest";
import {
  canSendPatientCommunication,
  createDefaultPatientCommunication,
  isChannelOptedOut,
  withDefaultPatientCommunication,
} from "../../utils/patientCommunication";

describe("patient communication preferences", () => {
  it("defaults both channels to no consent without opting the patient out", () => {
    expect(createDefaultPatientCommunication()).toEqual({
      email: { consent: false, optedOut: false },
      whatsapp: { consent: false, optedOut: false },
    });
  });

  it("does not share mutable default channel objects", () => {
    const first = createDefaultPatientCommunication();
    const second = createDefaultPatientCommunication();
    first.email.optedOut = true;
    expect(second.email.optedOut).toBe(false);
  });

  it("preserves stored choices while filling missing channel fields", () => {
    const patient = withDefaultPatientCommunication({
      communication: {
        email: { consent: true, optedOut: false },
        whatsapp: { consent: false, optedOut: true },
      },
    });
    expect(patient.communication.email.consent).toBe(true);
    expect(isChannelOptedOut(patient, "whatsapp")).toBe(true);
    expect(isChannelOptedOut(undefined, "email")).toBe(false);
  });

  it("blocks opt-outs and requires explicit consent only for marketing", () => {
    const noConsent = withDefaultPatientCommunication({});
    expect(canSendPatientCommunication(noConsent, "email", "clinical")).toEqual({
      allowed: true,
    });
    expect(canSendPatientCommunication(noConsent, "email", "marketing")).toEqual({
      allowed: false,
      reason: "consent_required",
    });

    const optedOut = withDefaultPatientCommunication({
      communication: {
        email: { consent: true, optedOut: true },
        whatsapp: { consent: true, optedOut: false },
      },
    });
    expect(canSendPatientCommunication(optedOut, "email", "transactional")).toEqual({
      allowed: false,
      reason: "opted_out",
    });
  });
});
