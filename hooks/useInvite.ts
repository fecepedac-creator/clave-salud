import { useState, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

export function useInvite() {
  const [inviteToken, setInviteToken] = useState<string>("");
  const [inviteLoading, setInviteLoading] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteCenterId, setInviteCenterId] = useState<string>("");
  const [inviteCenterName, setInviteCenterName] = useState<string>("");
  const [invitePassword, setInvitePassword] = useState<string>("");
  const [invitePassword2, setInvitePassword2] = useState<string>("");
  const [inviteMode, setInviteMode] = useState<"signup" | "signin">("signup");
  const [inviteDone, setInviteDone] = useState<boolean>(false);

  // Parse invite token from URL
  useEffect(() => {
    try {
      const path = window.location.pathname || "";
      if (!path.toLowerCase().startsWith("/invite")) return;

      const params = new URLSearchParams(window.location.search);
      const t = (params.get("token") || "").trim();
      if (!t) {
        setInviteError("Invitación inválida: falta el token.");
        return;
      }
      setInviteToken(t);
    } catch (e) {
      console.error("Error parsing invite URL:", e);
    }
  }, []);

  // Load invite data from Firestore
  useEffect(() => {
    const load = async () => {
      if (!inviteToken) return;
      setInviteLoading(true);
      setInviteError("");

      try {
        const token = inviteToken.trim();
        const snap = await getDoc(doc(db, "invites", token));
        if (!snap.exists()) throw new Error("Invitación no encontrada o inválida.");

        const inv: any = snap.data() || {};
        const status = String(inv.status || "").toLowerCase();
        if (status === "claimed") throw new Error("Esta invitación ya fue utilizada.");
        if (status === "revoked") throw new Error("Esta invitación fue revocada.");

        const emailLower = String(inv.emailLower || "")
          .trim()
          .toLowerCase();
        if (!emailLower) throw new Error("Invitación inválida: falta correo.");

        const expiresAt = inv.expiresAt;
        if (expiresAt && typeof expiresAt.toDate === "function") {
          const exp = expiresAt.toDate();
          if (exp.getTime() < Date.now())
            throw new Error("Esta invitación expiró. Solicita una nueva.");
        }

        setInviteEmail(emailLower);
        setInviteCenterId(String(inv.centerId || ""));
        setInviteCenterName(String(inv.centerName || ""));
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("missing") || msg.toLowerCase().includes("permission")) {
          setInviteError(
            "No se pudo leer la invitación por permisos. Inicia sesión (Google o Email/Password) y reintenta. " +
              "Si estás en Firebase Studio, agrega el dominio del workspace en Auth → Settings → Authorized domains."
          );
        } else {
          setInviteError(e?.message || "Error cargando invitación.");
        }
      } finally {
        setInviteLoading(false);
      }
    };

    load();
  }, [inviteToken]);

  const acceptInviteForUser = useCallback(
    async (tokenRaw: string, user: any) => {
      const token = (tokenRaw || "").trim();
      if (!token) throw new Error("Invitación inválida (sin token).");
      if (!user?.uid) throw new Error("Debes iniciar sesión para aceptar la invitación.");

      const uid = user.uid as string;
      const emailUser = String(user.email || "")
        .trim()
        .toLowerCase();
      if (!emailUser) throw new Error("Tu cuenta no tiene correo. Usa una cuenta con email.");

      const invRef = doc(db, "invites", token);
      const invSnap = await getDoc(invRef);
      if (!invSnap.exists()) throw new Error("Invitación no encontrada o inválida.");

      const inv: any = invSnap.data() || {};
      const status = String(inv.status || "").toLowerCase();
      if (status === "claimed" || status === "accepted")
        throw new Error("Esta invitación ya fue utilizada.");
      if (status === "revoked") throw new Error("Esta invitación fue revocada.");

      const emailLower = String(inv.emailLower || "")
        .trim()
        .toLowerCase();
      if (!emailLower) throw new Error("Invitación inválida: falta correo.");
      if (emailLower !== emailUser) {
        throw new Error(`Esta invitación es para ${emailLower}. Inicia sesión con ese correo.`);
      }

      const expiresAt = inv.expiresAt;
      if (expiresAt && typeof expiresAt.toDate === "function") {
        const exp = expiresAt.toDate();
        if (exp.getTime() < Date.now())
          throw new Error("Esta invitación expiró. Solicita una nueva.");
      }

      const centerId = String(inv.centerId || "").trim();
      if (!centerId) throw new Error("Invitación inválida: falta centerId.");

      const role = String(inv.role || "center_admin").trim() || "center_admin";
      const profileData = inv.profileData || {};

      // users/{uid} union roles/centers
      const uRef = doc(db, "users", uid);
      const uSnap = await getDoc(uRef);
      const existing: any = uSnap.exists() ? (uSnap.data() as any) : {};

      const prevCenters: string[] = Array.isArray(existing.centers)
        ? existing.centers
        : Array.isArray(existing.centros)
          ? existing.centros
          : [];
      const prevRoles: string[] = Array.isArray(existing.roles) ? existing.roles : [];

      const nextCenters = Array.from(new Set([...prevCenters, centerId])).filter(Boolean);
      const nextRoles = Array.from(new Set([...prevRoles, role])).filter(Boolean);

      await setDoc(
        uRef,
        {
          uid,
          email: emailUser,
          activo: true,
          centers: nextCenters,
          centros: nextCenters,
          roles: nextRoles,
          activeCenterId: existing.activeCenterId ?? nextCenters[0] ?? null,
          displayName: existing.displayName ?? user.displayName ?? "",
          photoURL: existing.photoURL ?? user.photoURL ?? "",
          updatedAt: serverTimestamp(),
          createdAt: existing.createdAt ?? serverTimestamp(),
        },
        { merge: true }
      );

      // staff membership with profile data from invite
      await setDoc(
        doc(db, "centers", centerId, "staff", uid),
        {
          uid,
          emailLower,
          role,
          roles: [role],
          active: true,
          activo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          inviteToken: token,
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

      // mark invite accepted
      await updateDoc(invRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        acceptedByUid: uid,
      }).catch(() => {});

      setInviteCenterId(centerId);
      setInviteCenterName(String(inv.centerName || inviteCenterName || ""));
      setInviteDone(true);
    },
    [inviteCenterName]
  );

  return {
    inviteToken,
    setInviteToken,
    inviteLoading,
    setInviteLoading,
    inviteError,
    setInviteError,
    inviteEmail,
    setInviteEmail,
    inviteCenterId,
    setInviteCenterId,
    inviteCenterName,
    setInviteCenterName,
    invitePassword,
    setInvitePassword,
    invitePassword2,
    setInvitePassword2,
    inviteMode,
    setInviteMode,
    inviteDone,
    setInviteDone,
    acceptInviteForUser,
  };
}
