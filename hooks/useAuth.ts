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
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { ViewMode } from "../types";

const SUPERADMIN_ALLOWED_EMAILS = new Set(["fecepedac@gmail.com", "dr.felipecepeda@gmail.com"]);

export function useAuth() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [isSuperAdminClaim, setIsSuperAdminClaim] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Listen to auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const token = await user.getIdTokenResult(true);
        setIsSuperAdminClaim(
          !!(
            (token.claims as any)?.super_admin === true ||
            (token.claims as any)?.superadmin === true ||
            (token.claims as any)?.superAdmin === true
          )
        );
      } else {
        setIsSuperAdminClaim(false);
      }
    });
    return () => unsub();
  }, []);

  const assertSuperAdminAccess = async (user: any) => {
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
      onSuccess: (user: any, view: ViewMode, centerId?: string) => void
    ) => {
      try {
        setError("");
        const emailNorm = email.trim().toLowerCase();

        const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
        const uid = cred.user.uid;

        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) throw new Error("Usuario sin perfil en el sistema");

        const profile: any = snap.data();
        if (profile.activo === false) throw new Error("Usuario inactivo");

        const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
        const roles: string[] = rolesRaw.map((r: any) => String(r ?? "").trim()).filter(Boolean);
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
          rolesNorm.includes("center admin");

        if (targetView === ("admin-dashboard" as ViewMode) && !(isCenterAdmin || isSuperAdmin)) {
          setError("No tiene permisos administrativos.");
          return;
        }

        const userFromFirestore = {
          uid,
          email: profile.email ?? emailNorm,
          roles,
          centros,
          isAdmin: isCenterAdmin || isSuperAdmin,
          fullName: profile.fullName ?? profile.nombre ?? profile.email ?? "Usuario",
          role:
            profile.role ??
            roles.find((r) => r !== "center_admin" && r !== "super_admin") ??
            "Profesional",
          id: uid,
        };
        setCurrentUser(userFromFirestore as any);

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
            await signInWithRedirect(auth, provider);
            return;
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
    async (targetView: ViewMode, onSuccess: (user: any) => void) => {
      try {
        setError("");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        const cred = await signInWithPopup(auth, provider);
        const user = cred.user;

        const uid = user.uid;
        const emailUser = (user.email || "").trim().toLowerCase();
        if (!emailUser) throw new Error("Tu cuenta Google no tiene email disponible.");

        const existingSnap = await getDoc(doc(db, "users", uid));
        if (existingSnap.exists()) {
          const profile: any = existingSnap.data();
          if (profile.activo === false) throw new Error("Usuario inactivo");

          const rolesRaw: string[] = Array.isArray(profile.roles) ? profile.roles : [];
          const roles: string[] = rolesRaw
            .map((r: any) =>
              String(r ?? "")
                .trim()
                .toLowerCase()
            )
            .filter(Boolean);

          let centers: string[] = Array.isArray(profile.centros)
            ? profile.centros
            : Array.isArray(profile.centers)
              ? profile.centers
              : [];

          // ── Check for pending invites even for existing users ──
          // This handles the case where an admin adds an already-registered
          // professional to a new center via the admin dashboard.
          const qPendingInv = query(
            collection(db, "invites"),
            where("emailLower", "==", emailUser),
            where("status", "==", "pending")
          );
          const pendingInvSnap = await getDocs(qPendingInv);

          if (!pendingInvSnap.empty) {
            const pendingInvites = pendingInvSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            const newCenters = pendingInvites
              .map((i) => String(i.centerId || "").trim())
              .filter((cId) => cId && !centers.includes(cId));
            const newRoles = pendingInvites
              .map((i) => String(i.role || "").trim())
              .filter(Boolean);

            // Merge new centers & roles into the existing profile
            if (newCenters.length > 0) {
              centers = [...centers, ...newCenters];
              const mergedRoles = Array.from(new Set([...roles, ...newRoles]));

              const updateData: any = {
                centros: centers,
                centers: centers,
                roles: mergedRoles,
                updatedAt: serverTimestamp(),
              };

              // Sync name from latest invite if available
              const latestInvite = pendingInvites[pendingInvites.length - 1];
              if (latestInvite?.profileData?.fullName) {
                updateData.fullName = latestInvite.profileData.fullName;
              }

              await updateDoc(doc(db, "users", uid), updateData);
              roles.push(...newRoles.filter((r) => !roles.includes(r)));
            }

            // Accept each invite & create staff docs
            await Promise.all(
              pendingInvites.map(async (inv) => {
                await updateDoc(doc(db, "invites", inv.id), {
                  status: "accepted",
                  acceptedAt: serverTimestamp(),
                  acceptedByUid: uid,
                }).catch(() => { });

                const cId = String(inv.centerId || "").trim();
                const rId = String(inv.role || "").trim() || "staff";
                const profileData = inv.profileData || {};

                if (cId) {
                  await setDoc(
                    doc(db, "centers", cId, "staff", uid),
                    {
                      uid,
                      emailLower: emailUser,
                      role: rId,
                      roles: [rId],
                      active: true,
                      activo: true,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      inviteToken: inv.id,
                      invitedBy: inv.invitedBy ?? null,
                      invitedAt: inv.createdAt ?? null,
                      fullName: profileData.fullName ?? "",
                      rut: profileData.rut ?? "",
                      specialty: profileData.specialty ?? "",
                      photoUrl: profileData.photoUrl ?? "",
                      agendaConfig: profileData.agendaConfig ?? null,
                      professionalRole: profileData.role ?? inv.professionalRole ?? "",
                      isAdmin: profileData.isAdmin ?? false,
                    },
                    { merge: true }
                  );
                }
              })
            );
          }

          const token = await user.getIdTokenResult(true).catch(() => null as any);
          const claims: any = token?.claims ?? {};

          const isSuperAdmin =
            claims?.super_admin === true ||
            claims?.superadmin === true ||
            claims?.superAdmin === true;

          const userFromFirestore = {
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
          };

          setCurrentUser(userFromFirestore as any);

          if (isSuperAdmin && targetView === ("superadmin-dashboard" as ViewMode)) {
            onSuccess(userFromFirestore);
            return;
          }

          onSuccess(userFromFirestore);
          return;
        }

        // If profile doesn't exist, check if user is a Super Admin (whitelist or claims)
        const qInv = query(
          collection(db, "invites"),
          where("emailLower", "==", emailUser),
          where("status", "==", "pending")
        );
        const invSnap = await getDocs(qInv);

        const tokenResult = await user.getIdTokenResult(true).catch(() => null);
        const claims: any = tokenResult?.claims ?? {};
        const isSuperAdminByClaim = !!(
          claims.super_admin === true ||
          claims.superadmin === true ||
          claims.superAdmin === true ||
          SUPERADMIN_ALLOWED_EMAILS.has(emailUser)
        );

        const inviteDocs = invSnap.empty ? [] : invSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        if (inviteDocs.length === 0 && !isSuperAdminByClaim) {
          throw new Error(
            "No tienes invitación activa. Pide al administrador del centro que te invite con este correo."
          );
        }

        const rolesFromInvites = Array.from(new Set(inviteDocs.map((i) => i.role).filter(Boolean)));
        const centersFromInvites = Array.from(
          new Set(inviteDocs.map((i) => i.centerId).filter(Boolean))
        );

        // If SuperAdmin but no invites, initialize with super_admin role
        const finalRoles = isSuperAdminByClaim ? Array.from(new Set([...rolesFromInvites, "super_admin"])) : rolesFromInvites;

        // Sync name from invite if provided
        const inviteName = inviteDocs.find(i => i.profileData?.fullName)?.profileData?.fullName;

        await setDoc(
          doc(db, "users", uid),
          {
            uid,
            email: emailUser,
            displayName: user.displayName ?? "",
            photoURL: user.photoURL ?? "",
            fullName: inviteName ?? user.displayName ?? "Usuario",
            roles: finalRoles,
            centers: centersFromInvites,
            centros: centersFromInvites,
            activo: true,
            createdAt: serverTimestamp(),
            activeCenterId: centersFromInvites?.[0] ?? null,
          },
          { merge: true }
        );

        await Promise.all(
          inviteDocs.map(async (inv) => {
            await updateDoc(doc(db, "invites", inv.id), {
              status: "accepted",
              acceptedAt: serverTimestamp(),
              acceptedByUid: uid,
            }).catch(() => { });

            const cId = String((inv as any).centerId || "").trim();
            const rId = String((inv as any).role || "").trim() || "staff";
            const eLower = String((inv as any).emailLower || emailUser)
              .trim()
              .toLowerCase();
            const profileData = (inv as any).profileData || {};

            if (cId) {
              await setDoc(
                doc(db, "centers", cId, "staff", uid),
                {
                  uid,
                  emailLower: eLower,
                  role: rId,
                  roles: [rId],
                  active: true,
                  activo: true,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  inviteToken: inv.id,
                  invitedBy: (inv as any).invitedBy ?? null,
                  invitedAt: (inv as any).createdAt ?? null,
                  fullName: profileData.fullName ?? "",
                  rut: profileData.rut ?? "",
                  specialty: profileData.specialty ?? "",
                  photoUrl: profileData.photoUrl ?? "",
                  agendaConfig: profileData.agendaConfig ?? null,
                  professionalRole: profileData.role ?? (inv as any).professionalRole ?? "",
                  isAdmin: profileData.isAdmin ?? false,
                },
                { merge: true }
              );
            }
          })
        );

        const newUser = {
          uid,
          email: emailUser,
          roles: rolesFromInvites,
          centers: centersFromInvites,
          centros: centersFromInvites,
          activeCenterId: centersFromInvites?.[0] ?? null,
          displayName: user.displayName ?? "",
          photoURL: user.photoURL ?? "",
          fullName: user.displayName ?? emailUser,
          id: uid,
        };

        setCurrentUser(newUser as any);
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
    } catch { }
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
    } catch { }
    setCurrentUser(null);
  }, []);

  // Handle OAuth redirect result
  const handleRedirectResult = useCallback(
    async (onSuccess: () => void, onUnauthorized: () => void) => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) return;
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
