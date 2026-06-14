import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";

export function useInvite() {
  const [inviteToken, setInviteToken] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCenterId, setInviteCenterId] = useState("");
  const [inviteCenterName, setInviteCenterName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePassword2, setInvitePassword2] = useState("");
  const [inviteMode, setInviteMode] = useState<"signup" | "signin">("signup");
  const [inviteDone, setInviteDone] = useState(false);

  useEffect(() => {
    if (!window.location.pathname.toLowerCase().startsWith("/invite")) return;
    const token = new URLSearchParams(window.location.search).get("token")?.trim() || "";
    if (!token) {
      setInviteError("Invitacion invalida: falta el token.");
      return;
    }
    setInviteToken(token);
  }, []);

  useEffect(() => {
    const loadInvite = async () => {
      if (!inviteToken) return;
      setInviteLoading(true);
      setInviteError("");
      try {
        const snap = await getDoc(doc(db, "invites", inviteToken));
        if (!snap.exists()) throw new Error("Invitacion no encontrada o invalida.");
        const invite: any = snap.data() || {};
        if (String(invite.status || "").toLowerCase() !== "pending") {
          throw new Error("Esta invitacion ya fue utilizada o no esta activa.");
        }
        if (invite.expiresAt?.toDate && invite.expiresAt.toDate().getTime() < Date.now()) {
          throw new Error("Esta invitacion expiro. Solicita una nueva.");
        }
        setInviteEmail(
          String(invite.emailLower || "")
            .trim()
            .toLowerCase()
        );
        setInviteCenterId(String(invite.centerId || "").trim());
        setInviteCenterName(String(invite.centerName || "").trim());
      } catch (error: any) {
        setInviteError(error?.message || "Error cargando invitacion.");
      } finally {
        setInviteLoading(false);
      }
    };
    void loadInvite();
  }, [inviteToken]);

  const acceptInviteForUser = useCallback(async (tokenRaw: string, user: any) => {
    const token = tokenRaw.trim();
    if (!token) throw new Error("Invitacion invalida: falta el token.");
    if (!user?.uid) throw new Error("Debes iniciar sesion para aceptar la invitacion.");
    const acceptInvite = httpsCallable<{ token: string }, { centerId: string }>(
      getFunctions(),
      "acceptInviteAtomic"
    );
    const result = await acceptInvite({ token });
    setInviteCenterId(String(result.data.centerId || ""));
    setInviteDone(true);
  }, []);

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
