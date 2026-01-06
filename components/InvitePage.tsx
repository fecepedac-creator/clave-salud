import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { signInGoogle, upsertBasicUserProfile } from "../services/auth";

type InviteData = {
  emailLower?: string;
  email?: string;
  centerId?: string;
  centerName?: string;
  role?: string;
  status?: "pending" | "claimed" | "revoked";
  expiresAt?: any; // Timestamp optional
};

type Props = {
  /** opcional: si App ya leyó token */
  token?: string;
  /** opcional: si quieres forzar un callback al terminar */
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

  const currentUser = auth.currentUser;
  const authEmailLower = lower(currentUser?.email || "");

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
      if (status === "claimed") throw new Error("Esta invitación ya fue utilizada.");
      if (status === "revoked") throw new Error("Esta invitación fue revocada.");

      // expiración opcional
      const expiresAt: any = (inv as any).expiresAt;
      if (expiresAt && typeof expiresAt.toDate === "function") {
        const exp = expiresAt.toDate();
        if (exp.getTime() < Date.now()) {
          throw new Error("Esta invitación expiró. Solicita una nueva.");
        }
      }

      if (!inv.centerId) throw new Error("Invitación inválida: falta centerId.");
      if (!inv.emailLower && !inv.email) throw new Error("Invitación inválida: falta email.");

      setInvite(inv);
    } catch (e: any) {
      // eslint-disable-next-line no-console
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
      const u = await signInGoogle();
      await upsertBasicUserProfile(u);
      await loadInvite(); // recargar por si el UI depende del user
    } catch (e: any) {
      // eslint-disable-next-line no-console
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
      setError("Para aceptar la invitación debes iniciar sesión con Google usando el correo invitado.");
      return;
    }

    if (authEmailLower !== inviteEmailLower) {
      setError(
        `Sesión incorrecta: estás con ${authEmailLower || "(sin correo)"} pero la invitación es para ${inviteEmailLower}.`
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const centerId = String(invite.centerId || "").trim();
      const roleRaw = String(invite.role || "center_admin").trim();

      // 1) Claim invite: pending -> claimed (tu rules lo permiten si email coincide)
      await setDoc(
        doc(db, "invites", token),
        {
          status: "claimed",
          claimedAt: serverTimestamp(),
          claimedByUid: user.uid,
        },
        { merge: true }
      );

      // 2) Actualizar users/{uid} para acceso por rules (roles/centros)
      // Nota: NO elevamos permisos por cliente “a ciegas”.
      // Esto solo es válido porque la invitación ya es una autorización explícita registrada en Firestore.
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || undefined,
          activo: true,
          updatedAt: serverTimestamp(),
          // Merge defensivo: si ya existen, se sobrescriben por arrays "mínimos".
          // (La versión final la haremos con Cloud Function para union segura)
          roles: [roleRaw],
          centros: [centerId],
        },
        { merge: true }
      );

      setDone(true);
      if (onDone) onDone();

      // Redirigir
      setTimeout(() => {
        window.location.href = "/";
      }, 600);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("InvitePage accept error:", e);
      setError(e?.message || "No se pudo aceptar la invitación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h1 className="text-xl font-bold">Invitación a ClaveSalud</h1>
        <p className="text-sm text-slate-400 mt-1">
          Para activar tu acceso, inicia sesión con el correo invitado y acepta la invitación.
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
                <span className="font-semibold text-slate-200 text-right">{invite.role || "center_admin"}</span>
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

        <p className="text-[11px] text-slate-500 mt-4">
          Si falla el login con popup en Firebase Studio, debes agregar el dominio del workspace en Firebase Console → Auth
          → Settings → Authorized domains.
        </p>
      </div>
    </div>
  );
}
