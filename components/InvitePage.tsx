import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import LogoHeader from "./LogoHeader";

type InviteData = {
  emailLower?: string;
  email?: string;
  centerId?: string;
  centerName?: string;
  role?: string;
  status?: "pending" | "claimed" | "revoked" | "accepted";
  expiresAt?: any;
  invitedBy?: string;
  createdAt?: any;
};

type Props = {
  token?: string;
  onDone?: () => void;
};

function lower(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function InvitePage({ token: tokenProp, onDone }: Props) {
  const token = useMemo(() => {
    if (tokenProp?.trim()) return tokenProp.trim();
    const params = new URLSearchParams(window.location.search);
    return (params.get("token") || "").trim();
  }, [tokenProp]);

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string>("");
  const [done, setDone] = useState(false);

  const authEmailLower = lower(auth.currentUser?.email || "");

  const loadInvite = async () => {
    if (!token) {
      setError("Invitación inválida: falta token.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const snap = await getDoc(doc(db, "invites", token));
      if (!snap.exists()) throw new Error("Invitación no encontrada o inválida.");

      const inv = (snap.data() || {}) as InviteData;

      const status = (inv.status || "pending").toLowerCase() as InviteData["status"];
      if (status === "claimed" || status === "accepted")
        throw new Error("Esta invitación ya fue utilizada.");
      if (status === "revoked") throw new Error("Esta invitación fue revocada.");

      const expiresAt: any = (inv as any).expiresAt;
      if (expiresAt && typeof expiresAt.toDate === "function") {
        const exp = expiresAt.toDate();
        if (exp.getTime() < Date.now())
          throw new Error("Esta invitación expiró. Solicita una nueva.");
      }

      if (!inv.centerId) throw new Error("Invitación inválida: falta centerId.");
      if (!inv.emailLower && !inv.email) throw new Error("Invitación inválida: falta email.");

      setInvite(inv);
    } catch (e: any) {
      console.error("InvitePage load error:", e);
      setError(e?.message || "Error cargando invitación.");
      setInvite(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      await loadInvite();
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "No se pudo iniciar sesión con Google. Revisa dominios autorizados en Firebase Auth (Authorized domains)."
      );
    }
  };

  const handleAcceptInvite = async () => {
    if (!invite) return;

    const inviteEmailLower = lower(invite.emailLower || invite.email || "");
    if (!inviteEmailLower) {
      setError("Invitación inválida: falta correo.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError(
        "Para aceptar la invitación debes iniciar sesión con Google usando el correo invitado."
      );
      return;
    }

    if (lower(user.email || "") !== inviteEmailLower) {
      setError(
        `Sesión incorrecta: estás con ${lower(user.email || "")} pero la invitación es para ${inviteEmailLower}.`
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const centerId = String(invite.centerId || "").trim();
      const accessRole = String(invite.role || "center_admin").trim() || "center_admin";
      const professionalRole =
        String((invite as any).professionalRole || "").trim() ||
        (accessRole === "doctor" ? "Medico" : accessRole);

      // 1) users/{uid} (merge, compat centers/centros)
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: lower(user.email || ""),
          activo: true,
          updatedAt: serverTimestamp(),
          roles: [accessRole],
          centers: [centerId],
          centros: [centerId],
        },
        { merge: true }
      );

      // 2) staff membership
      await setDoc(
        doc(db, "centers", centerId, "staff", user.uid),
        {
          uid: user.uid,
          emailLower: inviteEmailLower,
          role: professionalRole,
          roles: [accessRole],
          active: true,
          activo: true,
          createdAt: serverTimestamp(),
          inviteToken: token,
          invitedBy: (invite as any).invitedBy ?? null,
          invitedAt: (invite as any).createdAt ?? null,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "centers", centerId, "publicStaff", user.uid),
        {
          id: user.uid,
          centerId,
          fullName: (invite as any).fullName ?? user.displayName ?? user.email ?? "Profesional",
          role: professionalRole,
          specialty: (invite as any).specialty ?? "",
          photoUrl: (invite as any).photoUrl ?? user.photoURL ?? "",
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3) mark invite accepted
      await updateDoc(doc(db, "invites", token), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        acceptedByUid: user.uid,
      }).catch(() => {});

      setDone(true);
      if (onDone) onDone();

      setTimeout(() => {
        window.location.href = "/";
      }, 600);
    } catch (e: any) {
      console.error("InvitePage accept error:", e);
      setError(e?.message || "No se pudo aceptar la invitación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="mb-6">
          <LogoHeader size="md" showText={true} />
        </div>
        <h1 className="text-xl font-bold">Invitación a ClaveSalud</h1>
        <p className="text-sm text-slate-400 mt-1">
          Inicia sesión con el correo invitado y acepta la invitación.
        </p>

        <div className="mt-5 bg-slate-950 border border-slate-800 rounded-xl p-4">
          {loading && <p className="text-slate-400 text-sm">Cargando…</p>}

          {!loading && error && (
            <div className="text-sm text-red-300">
              <div className="font-bold mb-1">Error</div>
              <div>{error}</div>
            </div>
          )}

          {!loading && !error && invite && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Centro</span>
                <span className="font-semibold text-slate-200 text-right">
                  {invite.centerName || invite.centerId}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Correo</span>
                <span className="font-semibold text-slate-200 text-right">
                  {lower(invite.emailLower || invite.email || "")}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Rol</span>
                <span className="font-semibold text-slate-200 text-right">
                  {invite.role || "center_admin"}
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="text-slate-500 text-xs mb-2">Sesión actual</div>
                <div className="text-slate-200 text-sm">
                  {auth.currentUser ? authEmailLower : "No has iniciado sesión"}
                </div>
              </div>

              {done && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  Invitación aceptada. Redirigiendo…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          {!auth.currentUser ? (
            <button
              onClick={handleGoogleLogin}
              className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              Iniciar sesión con Google
            </button>
          ) : (
            <button
              onClick={handleAcceptInvite}
              disabled={loading || !invite}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold disabled:opacity-50"
            >
              Aceptar invitación
            </button>
          )}

          <button
            onClick={() => (window.location.href = "/")}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
