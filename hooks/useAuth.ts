import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ViewMode, UserProfile, AnyRole } from "../types";

const SUPERADMIN_ALLOWED_EMAILS = new Set(["fecepedac@gmail.com", "dr.felipecepeda@gmail.com"]);
const GOOGLE_REDIRECT_MODE_KEY = "cs_google_redirect_mode";
const GOOGLE_REDIRECT_TARGET_KEY = "cs_google_redirect_target";
const GOOGLE_REDIRECT_MODE_PROFESSIONAL = "professional";

export function useAuth() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isSuperAdminClaim, setIsSuperAdminClaim] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Listen to auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const token = await user.getIdTokenResult(true).catch(() => null);
          setIsSuperAdminClaim(
            !!(
              (token?.claims as any)?.super_admin === true ||
              (token?.claims as any)?.superadmin === true ||
              (token?.claims as any)?.superAdmin === true
            )
          );

          // Restore user profile from Firestore on reload
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const profile: any = snap.data();
            const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
            const roles: AnyRole[] = rolesRaw
              .map((r: any) => String(r ?? "").trim())
              .filter(Boolean) as AnyRole[];
            const rolesNorm = roles.map((r) => r.toLowerCase());

            const centros: string[] = Array.isArray(profile.centros) ? profile.centros : [];
            const claims: any = token?.claims ?? {};
            const isSuperAdmin =
              claims?.super_admin === true ||
              claims?.superadmin === true ||
              claims?.superAdmin === true;

            const isCenterAdmin = rolesNorm.some(
              (r) =>
                r.includes("centeradmin") ||
                r.includes("center_admin") ||
                r.includes("center-admin") ||
                r.includes("center admin") ||
                r === "administrativo" ||
                r === "administrativa" ||
                r === "admin" ||
                r === "secretaria"
            );

            const userProfile: UserProfile = {
              uid: user.uid,
              email: profile.email || user.email || "",
              roles,
              centers: centros,
              centros,
              isAdmin: !!(isCenterAdmin || isSuperAdmin || profile.isAdmin),
              fullName:
                profile.fullName ||
                profile.nombre ||
                profile.email ||
                user.displayName ||
                "Usuario",
              role:
                profile.role ||
                roles.find((r) => !r.toLowerCase().includes("doc")) ||
                "Profesional",
              id: user.uid,
              billing: profile.billing,
            };
            setCurrentUser(userProfile);
          }
        } catch (e) {
          console.error("Error restoring auth session profile:", e);
        }
      } else {
        setIsSuperAdminClaim(false);
        setCurrentUser(null);
      }
    });
    return () => unsub();
  }, []);

  const assertSuperAdminAccess = async (user: User) => {
    const emailUser = String(user?.email || "")
      .trim()
      .toLowerCase();
    if (!SUPERADMIN_ALLOWED_EMAILS.has(emailUser)) {
      throw new Error("superadmin-unauthorized");
    }
    const token = await user.getIdTokenResult(true);
    const claims: any = token?.claims ?? {};
    const hasClaim =
      claims?.super_admin === true || claims?.superadmin === true || claims?.superAdmin === true;
    if (!hasClaim) {
      throw new Error("superadmin-unauthorized");
    }
  };

  const handleSuperAdminLogin = useCallback(
    async (
      targetView: ViewMode,
      onSuccess: (user: UserProfile, view: ViewMode, centerId?: string) => void
    ) => {
      try {
        setError("");
        const emailNorm = email.trim().toLowerCase();

        const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
        const uid = cred.user.uid;

        const snap = await getDoc(doc(db, "users", uid));
        let profile: any;

        if (!snap.exists()) {
          // Si no existe perfil, lo creamos con valores por defecto (útil para testing y nuevos admins)
          const isDoc = targetView === ("doctor-dashboard" as ViewMode);
          const roles = isDoc ? ["MEDICO"] : ["center_admin", "admin"];
          profile = {
            uid,
            email: emailNorm,
            fullName: emailNorm.split("@")[0],
            roles: roles,
            centros: ["c_eji2qv61"],
            centers: ["c_eji2qv61"],
            activo: true,
            createdAt: serverTimestamp(),
            role: isDoc ? "MEDICO" : "center_admin",
          };
          await setDoc(doc(db, "users", uid), profile);
          console.log("✅ Perfil auto-creado para:", emailNorm);
        } else {
          profile = snap.data();
        }

        if (profile.activo === false)
          throw new Error("Su cuenta ha sido desactivada por el administrador.");
        if (profile.billing?.status === "suspended")
          throw new Error("Su acceso ha sido suspendido por falta de pago.");

        const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
        const roles: AnyRole[] = rolesRaw
          .map((r: any) => String(r ?? "").trim())
          .filter(Boolean) as AnyRole[];
        const rolesNorm = roles.map((r) => r.toLowerCase());

        const centros: string[] = Array.isArray(profile.centros) ? profile.centros : [];

        const token = await cred.user.getIdTokenResult(true).catch(() => null as any);
        const claims: any = token?.claims ?? {};

        const isSuperAdmin =
          claims?.super_admin === true ||
          claims?.superadmin === true ||
          claims?.superAdmin === true;

        const isCenterAdmin =
          rolesNorm.includes("centeradmin") ||
          rolesNorm.includes("center_admin") ||
          rolesNorm.includes("center-admin") ||
          rolesNorm.includes("center admin") ||
          rolesNorm.includes("administrativo") ||
          rolesNorm.includes("administrativa") ||
          rolesNorm.includes("secretaria") ||
          rolesNorm.includes("admin");

        if (targetView === ("admin-dashboard" as ViewMode) && !(isCenterAdmin || isSuperAdmin)) {
          setError("No tiene permisos administrativos.");
          return;
        }

        const userFromFirestore: UserProfile = {
          uid,
          email: profile.email ?? emailNorm,
          roles,
          centers: centros,
          centros,
          isAdmin: isCenterAdmin || isSuperAdmin,
          fullName: profile.fullName ?? profile.nombre ?? profile.email ?? "Usuario",
          role:
            profile.role ??
            roles.find((r) => r !== "center_admin" && r !== "super_admin") ??
            "Profesional",
          id: uid,
          billing: profile.billing,
        };
        setCurrentUser(userFromFirestore);

        if (isSuperAdmin && targetView === ("superadmin-dashboard" as ViewMode)) {
          onSuccess(userFromFirestore, "superadmin-dashboard" as ViewMode);
          return;
        }

        if (centros.length === 1) {
          onSuccess(userFromFirestore, targetView, centros[0]);
          return;
        }
        if (centros.length > 1) {
          onSuccess(userFromFirestore, "select-center" as ViewMode);
          return;
        }
        throw new Error("Usuario sin centros asignados");
      } catch (e: any) {
        console.error("LOGIN ERROR", e?.code, e?.message);
        setError(e?.message || "Credenciales inválidas o sin permisos");
      }
    },
    [email, password]
  );

  const handleSuperAdminGoogleLogin = useCallback(
    async (onSuccess: () => void, onUnauthorized: () => void) => {
      try {
        setError("");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
          const cred = await signInWithPopup(auth, provider);
          await assertSuperAdminAccess(cred.user);
          onSuccess();
        } catch (e: any) {
          const code = String(e?.code || "");
          const isPopupError =
            code === "auth/popup-blocked" ||
            code === "auth/popup-closed-by-user" ||
            code === "auth/cancelled-popup-request";

          if (isPopupError) {
            // No longer falling back to redirect automatically
            throw new Error("El popup fue bloqueado o cerrado.");
          }

          if (e?.message === "superadmin-unauthorized") {
            await onUnauthorized();
            return;
          }

          throw e;
        }
      } catch (e: any) {
        console.error("SUPERADMIN GOOGLE LOGIN ERROR", e);
        setError(e?.message || "No se pudo iniciar sesión con Google.");
      }
    },
    []
  );

  const handleGoogleLogin = useCallback(
    async (targetView: ViewMode, onSuccess: (user: UserProfile) => void) => {
      try {
        setError("");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        if (window.location.hostname === "localhost") {
          window.sessionStorage.setItem(
            GOOGLE_REDIRECT_MODE_KEY,
            GOOGLE_REDIRECT_MODE_PROFESSIONAL
          );
          window.sessionStorage.setItem(GOOGLE_REDIRECT_TARGET_KEY, String(targetView));
          await signInWithRedirect(auth, provider);
          return;
        }

        let user;
        try {
          const cred = await signInWithPopup(auth, provider);
          user = cred.user;
        } catch (e: any) {
          const code = String(e?.code || "");
          const isPopupError =
            code === "auth/popup-blocked" ||
            code === "auth/popup-closed-by-user" ||
            code === "auth/cancelled-popup-request";

          if (isPopupError) {
            // No longer falling back to redirect automatically to avoid loop in Chrome
            console.warn("Popup blocked/closed by user.");
            throw new Error(
              "El popup fue bloqueado o cerrado. Por favor, habilita los popups o intenta nuevamente."
            );
          }
          throw e;
        }

        const uid = user.uid;
        const emailUser = (user.email || "").trim().toLowerCase();
        if (!emailUser) throw new Error("Tu cuenta Google no tiene email disponible.");

        const acceptPendingInvites = httpsCallable(getFunctions(), "acceptPendingInvites");
        await acceptPendingInvites({}).catch((inviteError) => {
          console.warn("No fue posible conciliar invitaciones pendientes:", inviteError);
        });

        const existingSnap = await getDoc(doc(db, "users", uid));
        if (existingSnap.exists()) {
          const profile: any = existingSnap.data();
          if (profile.activo === false)
            throw new Error("Su cuenta ha sido desactivada por el administrador.");
          if (profile.billing?.status === "suspended")
            throw new Error("Su acceso ha sido suspendido por falta de pago.");

          const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
          const roles: AnyRole[] = rolesRaw
            .map(
              (r: any) =>
                String(r ?? "")
                  .trim()
                  .toLowerCase() as AnyRole
            )
            .filter(Boolean);

          let centers: string[] = Array.isArray(profile.centros)
            ? profile.centros
            : Array.isArray(profile.centers)
              ? profile.centers
              : [];

          const token = await user.getIdTokenResult(true).catch(() => null as any);
          const claims: any = token?.claims ?? {};
          const isSuperAdmin =
            claims?.super_admin === true ||
            claims?.superadmin === true ||
            claims?.superAdmin === true;

          const isAdmin = !!(
            roles.some((r) => {
              const low = String(r || "").toLowerCase();
              return (
                low.includes("admin") ||
                low === "administrativo" ||
                low === "administrativa" ||
                low === "secretaria"
              );
            }) ||
            isSuperAdmin ||
            profile.isAdmin
          );

          const userFromFirestore: UserProfile = {
            uid,
            email: profile.email ?? emailUser,
            roles,
            centers,
            centros: centers,
            activeCenterId: profile.activeCenterId ?? centers?.[0] ?? null,
            displayName: profile.displayName ?? user.displayName ?? "",
            photoURL: profile.photoURL ?? user.photoURL ?? "",
            fullName:
              profile.fullName ?? profile.nombre ?? profile.email ?? user.displayName ?? "Usuario",
            id: uid,
            isAdmin,
            billing: profile.billing,
          };

          setCurrentUser(userFromFirestore);
          onSuccess(userFromFirestore);
          return;
        }

        const tokenResult = await user.getIdTokenResult(true).catch(() => null);
        const claims: any = tokenResult?.claims ?? {};
        const isSuperAdminByClaim = !!(
          claims.super_admin === true ||
          claims.superadmin === true ||
          claims.superAdmin === true ||
          SUPERADMIN_ALLOWED_EMAILS.has(emailUser)
        );

        if (!isSuperAdminByClaim) {
          throw new Error(
            "No tienes invitación activa. Pide al administrador del centro que te invite con este correo."
          );
        }

        const finalRoles: AnyRole[] = ["super_admin" as AnyRole];
        const centersFromInvites: string[] = [];

        await setDoc(
          doc(db, "users", uid),
          {
            uid,
            email: emailUser,
            displayName: user.displayName ?? "",
            photoURL: user.photoURL ?? "",
            fullName: user.displayName ?? "Usuario",
            roles: finalRoles,
            centers: centersFromInvites,
            centros: centersFromInvites,
            activo: true,
            createdAt: serverTimestamp(),
            activeCenterId: centersFromInvites?.[0] ?? null,
          },
          { merge: true }
        );

        const newUser: UserProfile = {
          uid,
          email: emailUser,
          roles: finalRoles,
          centers: centersFromInvites,
          centros: centersFromInvites,
          activeCenterId: centersFromInvites?.[0] ?? null,
          displayName: user.displayName ?? "",
          photoURL: user.photoURL ?? "",
          fullName: user.displayName ?? emailUser,
          id: uid,
        };

        setCurrentUser(newUser);
        onSuccess(newUser);
      } catch (e: any) {
        console.error("GOOGLE LOGIN ERROR", e);
        setError(e?.message || "No se pudo iniciar sesión con Google.");
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    setCurrentUser(null);
    setEmail("");
    setPassword("");
  }, []);

  const bootstrapSuperAdmin = useCallback(async () => {
    if (!authUser) {
      alert("Debes iniciar sesión primero");
      return;
    }
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, "setSuperAdmin");
      await fn({ uid: authUser.uid });
      alert(`✅ Usuario convertido en SuperAdmin.
Cierra sesión y vuelve a ingresar para aplicar permisos.`);
    } catch (e: any) {
      console.error("BOOTSTRAP ERROR", e);
      alert(e?.message || "Error al ejecutar bootstrap");
    }
  }, [authUser]);

  const handleSuperAdminUnauthorized = useCallback(async () => {
    setError("No autorizado");
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    setCurrentUser(null);
  }, []);

  // Handle OAuth redirect result
  const handleRedirectResult = useCallback(
    async (
      onSuccess: () => void,
      onUnauthorized: () => void,
      onProfessionalSuccess: (user: UserProfile, targetView: ViewMode) => void
    ) => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) return;
        const redirectMode = window.sessionStorage.getItem(GOOGLE_REDIRECT_MODE_KEY);
        const redirectTarget =
          (window.sessionStorage.getItem(GOOGLE_REDIRECT_TARGET_KEY) as ViewMode | null) ??
          ("doctor-dashboard" as ViewMode);
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_MODE_KEY);
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_TARGET_KEY);
        if (redirectMode === GOOGLE_REDIRECT_MODE_PROFESSIONAL) {
          const snap = await getDoc(doc(db, "users", result.user.uid));
          if (!snap.exists()) {
            throw new Error(
              "Tu cuenta Google fue autenticada, pero aún no tiene un perfil activo en ClaveSalud."
            );
          }
          const profile: any = snap.data();
          if (profile.activo === false) throw new Error("Usuario inactivo");
          const roles = (Array.isArray(profile.roles) ? profile.roles : [])
            .map((role: unknown) => String(role ?? "").trim())
            .filter(Boolean) as AnyRole[];
          const centros: string[] = Array.isArray(profile.centros)
            ? profile.centros
            : Array.isArray(profile.centers)
              ? profile.centers
              : [];
          const userProfile: UserProfile = {
            uid: result.user.uid,
            id: result.user.uid,
            email: profile.email || result.user.email || "",
            roles,
            centers: centros,
            centros,
            fullName:
              profile.fullName ||
              profile.nombre ||
              profile.email ||
              result.user.displayName ||
              "Usuario",
            role: profile.role || roles[0] || "Profesional",
            billing: profile.billing,
          };
          setCurrentUser(userProfile);
          onProfessionalSuccess(userProfile, redirectTarget);
          return;
        }
        await assertSuperAdminAccess(result.user);
        onSuccess();
      } catch (e: any) {
        if (e?.message === "superadmin-unauthorized") {
          await onUnauthorized();
          return;
        }
        console.error("SUPERADMIN REDIRECT ERROR", e);
        setError(e?.message || "No se pudo iniciar sesión con Google.");
      }
    },
    []
  );

  return {
    authUser,
    isSuperAdminClaim,
    currentUser,
    email,
    setEmail,
    password,
    setPassword,
    error,
    setError,
    setCurrentUser,
    handleSuperAdminLogin,
    handleSuperAdminGoogleLogin,
    handleGoogleLogin,
    handleLogout,
    bootstrapSuperAdmin,
    handleSuperAdminUnauthorized,
    handleRedirectResult,
    assertSuperAdminAccess,
  };
}
