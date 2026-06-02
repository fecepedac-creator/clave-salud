import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "../firebase";
import LogoHeader from "./LogoHeader";

type InviteData = {
  emailLower?: string;
  email?: string;
  centerId?: string;
  centerName?: string;
  role?: string;
  status?: "pending" | "claimed" | "revoked" | "accepted";
  expiresAt?: any;
};

type Props = {
  token?: string;
  onDone?: () => void;
};

const lower = (value: string) => value.trim().toLowerCase();

export default function InvitePage({ token: tokenProp, onDone }: Props) {
  const token = useMemo(
    () =>
      tokenProp?.trim() || new URLSearchParams(window.location.search).get("token")?.trim() || "",
    [tokenProp]
  );
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const loadInvite = async () => {
    if (!token) {
      setError("Invitacion invalida: falta token.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const snap = await getDoc(doc(db, "invites", token));
      if (!snap.exists()) throw new Error("Invitacion no encontrada o invalida.");
      const data = snap.data() as InviteData;
      if (data.status !== "pending") throw new Error("Esta invitacion ya no esta activa.");
      if (data.expiresAt?.toDate && data.expiresAt.toDate().getTime() < Date.now()) {
        throw new Error("Esta invitacion expiro. Solicita una nueva.");
      }
      setInvite(data);
    } catch (cause: any) {
      setError(cause?.message || "No se pudo cargar la invitacion.");
      setInvite(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvite();
  }, [token]);

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      await loadInvite();
    } catch (cause: any) {
      setError(cause?.message || "No se pudo iniciar sesion con Google.");
    }
  };

  const handleAcceptInvite = async () => {
    if (!invite) return;
    const user = auth.currentUser;
    const invitedEmail = lower(invite.emailLower || invite.email || "");
    if (!user) {
      setError("Debes iniciar sesion con Google usando el correo invitado.");
      return;
    }
    if (lower(user.email || "") !== invitedEmail) {
      setError(`La invitacion corresponde a ${invitedEmail}.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const acceptInvite = httpsCallable<{ token: string }, { centerId: string }>(
        getFunctions(),
        "acceptInviteAtomic"
      );
      await acceptInvite({ token });
      setDone(true);
      onDone?.();
      window.setTimeout(() => {
        window.location.href = "/";
      }, 600);
    } catch (cause: any) {
      setError(cause?.message || "No se pudo aceptar la invitacion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <LogoHeader size="md" showText={true} />
        <h1 className="text-xl font-bold mt-6">Invitacion a ClaveSalud</h1>
        <p className="text-sm text-slate-400 mt-1">
          Inicia sesion con el correo invitado y acepta el acceso al centro.
        </p>

        <div className="mt-5 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          {loading && <p className="text-slate-400 text-sm">Cargando...</p>}
          {!loading && error && <p className="text-sm text-red-300">{error}</p>}
          {!loading && done && <p className="text-sm text-emerald-300">Invitacion aceptada.</p>}
          {!loading && invite && !done && (
            <>
              <p className="text-sm">Centro: {invite.centerName || invite.centerId}</p>
              <p className="text-sm">Correo: {invite.emailLower || invite.email}</p>
              <p className="text-sm">Rol de acceso: {invite.role || "professional"}</p>
              {!auth.currentUser ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full rounded-lg bg-white text-slate-900 px-4 py-2 font-bold"
                >
                  Continuar con Google
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-bold"
                >
                  Aceptar invitacion
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
