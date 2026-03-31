import React from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup, UserCredential } from "firebase/auth";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import LogoHeader from "../LogoHeader";
import LegalLinks from "../LegalLinks";

export const LoginView: React.FC<{
  isDoc: boolean;
  email: string;
  password: string;
  error: string;
  masterAccess: boolean;
  activeCenterId: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onBack: () => void;
  onLogin: () => void;
  onMasterAccess: () => void;
  onGoogleLogin: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  renderHomeBackdrop: (children: React.ReactNode) => React.ReactNode;
  renderCenterBackdrop: (children: React.ReactNode) => React.ReactNode;
}> = ({
  isDoc,
  email,
  password,
  error,
  masterAccess,
  activeCenterId,
  onEmailChange,
  onPasswordChange,
  onBack,
  onLogin,
  onMasterAccess,
  onGoogleLogin,
  onOpenTerms,
  onOpenPrivacy,
  renderHomeBackdrop,
  renderCenterBackdrop,
}) => {
  const content = (
    <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
      <div className="flex flex-col items-center gap-6">
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.12)] w-full relative transition-all border border-white/40 max-w-md">
          <button
            onClick={onBack}
            className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col gap-10 mt-6">
            <div className="mb-2">
              <LogoHeader size="lg" showText={true} className="mx-auto w-fit scale-110" />
            </div>
            <h2 className="text-3xl font-extrabold text-center text-slate-900 tracking-tight">
              {isDoc ? "Acceso Profesional" : "Acceso Administrativo"}
            </h2>

            <div className="space-y-6 max-w-sm mx-auto w-full">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors font-medium text-slate-700"
                  placeholder="nombre@centro.cl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <p className="text-red-500 font-bold text-sm text-center bg-red-50 p-3 rounded-xl border border-red-100">
                  {error}
                </p>
              )}
              <button
                onClick={onLogin}
                className={`w-full py-4 rounded-2xl font-bold text-white text-lg shadow-xl shadow-opacity-20 transition-all hover:-translate-y-0.5 active:scale-95 ${
                  isDoc
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-100"
                    : "bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 shadow-slate-100"
                }`}
              >
                Ingresar
              </button>

              {masterAccess && (
                <button
                  onClick={onMasterAccess}
                  className="w-full py-4 rounded-2xl font-bold bg-slate-900 text-white hover:bg-black shadow-xl transition-all border-2 border-slate-700 flex items-center justify-center gap-2 group"
                >
                  <Lock className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  Ingreso Rápido (Profesional / Admin)
                </button>
              )}

              <button
                onClick={onGoogleLogin}
                className="w-full py-4 rounded-2xl font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 shadow-lg transition-transform active:scale-95"
              >
                Continuar con Google
              </button>
            </div>
          </div>
        </div>
        <LegalLinks onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} />
      </div>
    </div>
  );

  if (isDoc && activeCenterId) return renderCenterBackdrop(content);
  return renderHomeBackdrop(content);
};

export const SuperAdminLoginView: React.FC<{
  error: string;
  onBack: () => void;
  onGoogleLogin: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  renderHomeBackdrop: (children: React.ReactNode) => React.ReactNode;
}> = ({ error, onBack, onGoogleLogin, onOpenTerms, onOpenPrivacy, renderHomeBackdrop }) =>
  renderHomeBackdrop(
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="mb-6">
            <LogoHeader size="md" showText={true} className="mb-4" />
          </div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <Lock className="w-6 h-6 text-slate-700" />
              Acceso SuperAdmin
            </h2>
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Volver
            </button>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleLogin}
              className="w-full rounded-xl bg-slate-900 text-white font-bold py-3 hover:bg-slate-800 transition-colors"
            >
              Ingresar con Google
            </button>
          </div>
        </div>
        <LegalLinks onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} />
      </div>
    </div>
  );

export const InviteRegisterView: React.FC<{
  inviteMode: "signup" | "signin";
  inviteCenterName: string;
  inviteError: string;
  inviteDone: boolean;
  inviteLoading: boolean;
  inviteToken: string;
  inviteEmail: string;
  invitePassword: string;
  invitePassword2: string;
  setInviteError: (value: string) => void;
  setInviteLoading: (value: boolean) => void;
  setInviteMode: (mode: "signup" | "signin") => void;
  setInviteEmail: (value: string) => void;
  setInvitePassword: (value: string) => void;
  setInvitePassword2: (value: string) => void;
  setInviteToken: (value: string) => void;
  acceptInviteForUser: (token: string, user: UserCredential["user"]) => Promise<void>;
  showToast: (message: string, type: "success" | "error" | "info" | "warning") => void;
  onClose: () => void;
}> = ({
  inviteMode,
  inviteCenterName,
  inviteError,
  inviteDone,
  inviteLoading,
  inviteToken,
  inviteEmail,
  invitePassword,
  invitePassword2,
  setInviteError,
  setInviteLoading,
  setInviteMode,
  setInviteEmail,
  setInvitePassword,
  setInvitePassword2,
  setInviteToken,
  acceptInviteForUser,
  showToast,
  onClose,
}) => {
  const isSignup = inviteMode === "signup";

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
          {isSignup ? "Crear cuenta" : "Iniciar sesión"}
        </h2>

        <p className="text-slate-500 text-sm mb-6">
          {inviteCenterName ? (
            <>
              Has sido invitado(a) para administrar{" "}
              <span className="font-bold text-slate-700">{inviteCenterName}</span>.
            </>
          ) : (
            <>Has sido invitado(a) para administrar un centro en ClaveSalud.</>
          )}
        </p>

        {inviteError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {inviteError}
          </div>
        )}

        {inviteDone ? (
          <>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm">
              Invitación aceptada. Ya puedes continuar.
            </div>
            <button
              type="button"
              className="w-full mt-4 rounded-xl bg-sky-600 text-white font-bold py-3 hover:bg-sky-700 transition-colors"
              onClick={onClose}
            >
              Ir a inicio
            </button>
          </>
        ) : (
          <>
            <label className="block mb-4">
              <span className="text-sm font-semibold text-slate-600">Correo</span>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value.trim().toLowerCase())}
                type="email"
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="correo@dominio.cl"
                autoComplete="email"
              />
            </label>

            <label className="block mb-5">
              <span className="text-sm font-semibold text-slate-600">Contraseña</span>
              <input
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="••••••••"
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </label>

            {isSignup && (
              <label className="block mb-5">
                <span className="text-sm font-semibold text-slate-600">Repetir contraseña</span>
                <input
                  value={invitePassword2}
                  onChange={(e) => setInvitePassword2(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </label>
            )}

            <button
              type="button"
              disabled={inviteLoading || !inviteEmail}
              onClick={async () => {
                try {
                  setInviteError("");
                  setInviteLoading(true);

                  const token = inviteToken.trim();
                  if (!token) throw new Error("Invitación inválida (sin token).");
                  if (!inviteEmail) throw new Error("Ingresa un correo.");

                  if (isSignup) {
                    if (invitePassword.length < 8) {
                      throw new Error("La contraseña debe tener al menos 8 caracteres.");
                    }
                    if (invitePassword !== invitePassword2) {
                      throw new Error("Las contraseñas no coinciden.");
                    }

                    try {
                      const cred = await createUserWithEmailAndPassword(
                        auth,
                        inviteEmail,
                        invitePassword
                      );
                      await acceptInviteForUser(token, cred.user);
                      showToast("Cuenta creada y invitación aceptada", "success");
                    } catch (e: any) {
                      if (e?.code === "auth/email-already-in-use") {
                        setInviteMode("signin");
                        throw new Error(
                          "Este correo ya existe. Inicia sesión para aceptar la invitación."
                        );
                      }
                      if (e?.code === "auth/operation-not-allowed") {
                        throw new Error(
                          "Email/Password no está habilitado en Firebase Auth. Habilítalo en Console -> Auth -> Método de acceso."
                        );
                      }
                      throw e;
                    }
                  } else {
                    const cred = await signInWithEmailAndPassword(auth, inviteEmail, invitePassword);
                    await acceptInviteForUser(token, cred.user);
                    showToast("Invitación aceptada", "success");
                  }
                } catch (e: any) {
                  console.error("INVITE FLOW ERROR", e);
                  setInviteError(e?.message || "No se pudo completar la invitación.");
                } finally {
                  setInviteLoading(false);
                }
              }}
              className="w-full rounded-xl bg-sky-600 text-white font-bold py-3 hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              {isSignup ? "Crear cuenta" : "Iniciar sesión"}
            </button>

            <button
              type="button"
              disabled={inviteLoading}
              onClick={async () => {
                try {
                  setInviteError("");
                  setInviteLoading(true);
                  const token = inviteToken.trim();
                  if (!token) throw new Error("Invitación inválida (sin token).");
                  const prov = new GoogleAuthProvider();
                  const cred = await signInWithPopup(auth, prov);
                  await acceptInviteForUser(token, cred.user);
                  showToast("Invitación aceptada", "success");
                } catch (e: any) {
                  console.error("INVITE GOOGLE ERROR", e);
                  setInviteError(e?.message || "No se pudo iniciar sesión con Google.");
                } finally {
                  setInviteLoading(false);
                }
              }}
              className="w-full mt-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Continuar con Google
            </button>

            <button
              type="button"
              onClick={() => {
                setInviteError("");
                setInviteMode(isSignup ? "signin" : "signup");
              }}
              className="w-full mt-3 text-sm text-slate-600 underline underline-offset-4 hover:text-slate-800"
            >
              {isSignup ? "Ya tengo cuenta" : "Quiero crear una cuenta nueva"}
            </button>

            <button
              type="button"
              onClick={() => {
                setInviteError("");
                setInviteToken("");
                onClose();
              }}
              className="w-full mt-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
};
