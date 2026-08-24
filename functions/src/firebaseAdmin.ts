import { getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
} from "firebase-admin/firestore";

export function ensureApp(): App {
  return getApps().length ? getApp() : initializeApp();
}

export const app = ensureApp();
export const db = getFirestore(app);

export { FieldValue, Timestamp };
export type { DocumentReference, DocumentSnapshot };
