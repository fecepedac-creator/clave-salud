import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

export type PublicAppointmentAction = "lookup" | "cancel" | "book";

export type PublicAppointmentChallenge = {
  challengeId: string;
  challengeToken: string;
  expiresAt: number;
};

export async function issuePublicAppointmentChallenge(input: {
  centerId: string;
  action: PublicAppointmentAction;
  rut: string;
  phone: string;
}): Promise<PublicAppointmentChallenge> {
  const fn = httpsCallable(functions, "issuePublicAppointmentChallenge");
  const response = await fn(input);
  const data = (response.data || {}) as Partial<PublicAppointmentChallenge>;

  if (!data.challengeId || !data.challengeToken || typeof data.expiresAt !== "number") {
    throw new Error("No se pudo obtener el challenge de seguridad.");
  }

  return {
    challengeId: data.challengeId,
    challengeToken: data.challengeToken,
    expiresAt: data.expiresAt,
  };
}
