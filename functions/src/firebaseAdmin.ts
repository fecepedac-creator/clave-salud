import { getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
} from "firebase-admin/firestore";

export function ensureApp(): App {
  return getApps().length ? getApp() : initializeApp();
}

export const app = ensureApp();
export const db = getFirestore(app);

export { FieldValue };
export type { DocumentReference, DocumentSnapshot };
