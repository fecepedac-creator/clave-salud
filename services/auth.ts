import { auth, db } from "../firebase";
import {
  GoogleAuthProvider,
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  getIdTokenResult,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export type UserRole = "super_admin" | "center_admin" | "admin" | "doctor" | "staff";

export type UserProfile = {
  email?: string;
  activo?: boolean;
  roles?: UserRole[] | string[];
  centros?: any; // compat con tu esquema actual (array/map). Lo endurecemos después.
  updatedAt?: any;
  createdAt?: any;
};

export const googleProvider = new GoogleAuthProvider();

/** Fuerza refresh del token (para que entren nuevos custom claims) */
export async function refreshIdToken(user: User) {
  try {
    await user.getIdToken(true);
    return await getIdTokenResult(user, true);
  } catch {
    return await getIdTokenResult(user, true);
  }
}

export async function getClaims(user: User) {
  const res = await getIdTokenResult(user, true);
  return res.claims;
}

export async function signInGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** Crea/actualiza perfil mínimo (no eleva permisos; solo registra) */
export async function upsertBasicUserProfile(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const base: UserProfile = {
    email: user.email ?? undefined,
    activo: true,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, { ...base, roles: [], centros: [], createdAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, base, { merge: true });
  }
}

/** Detecta si es superadmin (custom claim o users/{uid}.roles) */
export async function isSuperAdmin(user: User): Promise<boolean> {
  const claims = await getClaims(user);
  if ((claims as any).super_admin === true || (claims as any).superadmin === true) return true;
  if ((claims as any).role === "super_admin") return true;

  const profile = await getUserProfile(user.uid);
  const rolesRaw = (profile?.roles ?? []) as string[];
  const roles = rolesRaw.map((r) => String(r ?? "").trim().toLowerCase());
  return roles.includes("super_admin");
}
