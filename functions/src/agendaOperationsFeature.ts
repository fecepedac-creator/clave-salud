import * as functions from "firebase-functions/v1";

export const agendaOperationsV2Enabled = () =>
  process.env.ENABLE_AGENDA_OPERATIONS_V2 === "true" ||
  Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export const requireAgendaOperationsV2 = () => {
  if (!agendaOperationsV2Enabled()) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Función no habilitada para este entorno."
    );
  }
};
