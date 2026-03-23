import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "../../../firebase";
import { MessageCircle, Plus, Save, Phone, Check, Shield, Copy, Lock } from "lucide-react";
import { Auth } from "firebase/auth";
import { Firestore } from "firebase/firestore";
import WhatsappTemplatesManager from "../../../components/WhatsappTemplatesManager";

interface WhatsappSettingsProps {
  db: Firestore;
  auth: Auth;
  activeCenterId: string;
  resolvedCenterId: string;
  showToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const WhatsappSettings: React.FC<WhatsappSettingsProps> = ({
  db,
  auth,
  activeCenterId,
  resolvedCenterId,
  showToast,
}) => {
  // --- WHATSAPP TEMPLATES (per center) ---
  const DEFAULT_WA_TEMPLATES: any[] = [
    {
      id: "reminder",
      title: "Recordatorio de control",
      body: "Estimado/a {patientName}, le recordamos su control programado para el {nextControlDate} en {centerName}. Si no puede asistir, por favor responda a este mensaje para reagendar.",
      enabled: true,
    },
    {
      id: "confirm",
      title: "Confirmar asistencia",
      body: "Estimado/a {patientName}, ¿podría confirmar su asistencia al control del {nextControlDate} en {centerName}? Responda SI para confirmar o NO para reagendar.",
      enabled: true,
    },
    {
      id: "reschedule",
      title: "Reagendar",
      body: "Estimado/a {patientName}, si necesita reagendar su control del {nextControlDate} en {centerName}, indíquenos una fecha/horario alternativo y le ayudaremos.",
      enabled: true,
    },
  ];

  const [waTemplates, setWaTemplates] = useState<any[]>(DEFAULT_WA_TEMPLATES);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [waTemplatesSaving, setWaTemplatesSaving] = useState(false);

  // --- BOT CONFIG (secretaryPhone + API credentials) ---
  const [botSecretaryPhone, setBotSecretaryPhone] = useState("");
  const [botConfigLoading, setBotConfigLoading] = useState(false);
  const [botConfigSaving, setBotConfigSaving] = useState(false);
  const [botPhoneNumberId, setBotPhoneNumberId] = useState("");
  const [botAccessToken, setBotAccessToken] = useState("");
  const [botApiSaving, setBotApiSaving] = useState(false);

  useEffect(() => {
    // Load templates for active center
    const load = async () => {
      if (!db || !activeCenterId) return;
      setWaTemplatesLoading(true);
      try {
        const ref = doc(db, "centers", activeCenterId, "settings", "whatsapp");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (Array.isArray(data.templates) && data.templates.length > 0) {
            setWaTemplates(data.templates);
          } else {
            setWaTemplates(DEFAULT_WA_TEMPLATES);
          }
        } else {
          setWaTemplates(DEFAULT_WA_TEMPLATES);
        }
      } catch (e) {
        console.error("load wa templates", e);
        setWaTemplates(DEFAULT_WA_TEMPLATES);
      } finally {
        setWaTemplatesLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCenterId, db]);

  // Load whatsappConfig (secretaryPhone) from center document
  useEffect(() => {
    const loadBotConfig = async () => {
      if (!db || !resolvedCenterId) return;
      setBotConfigLoading(true);
      try {
        const centerRef = doc(db, "centers", resolvedCenterId);
        const snap = await getDoc(centerRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setBotSecretaryPhone(data?.whatsappConfig?.secretaryPhone || "");
          setBotPhoneNumberId(data?.whatsappConfig?.phoneNumberId || "");
          // Never pre-fill the token for security; only show presence
          setBotAccessToken(data?.whatsappConfig?.accessToken ? "********" : "");
        }
      } catch (e) {
        console.error("load bot config", e);
      } finally {
        setBotConfigLoading(false);
      }
    };
    loadBotConfig();
  }, [resolvedCenterId, db]);

  const saveWaTemplates = async () => {
    if (!db || !activeCenterId) return;
    setWaTemplatesSaving(true);
    try {
      const ref = doc(db, "centers", activeCenterId, "settings", "whatsapp");
      await setDoc(
        ref,
        {
          templates: waTemplates.map((t) => ({
            id: t.id,
            title: t.title,
            body: t.body,
            enabled: t.enabled !== false,
          })),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || null,
        },
        { merge: true }
      );
      showToast("Plantillas de WhatsApp guardadas.", "success");
    } catch (e) {
      console.error("save wa templates", e);
      showToast("No se pudieron guardar las plantillas.", "error");
    } finally {
      setWaTemplatesSaving(false);
    }
  };

  const addWaTemplate = () => {
    setWaTemplates((prev) => [
      ...prev,
      {
        id: `tpl_${Date.now()}`,
        title: "Nueva plantilla",
        body: "Estimado/a {patientName}, ...",
        enabled: true,
      },
    ]);
  };

  const removeWaTemplate = (id: string) => {
    setWaTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const saveBotConfig = async () => {
    if (!db || !resolvedCenterId) return;
    setBotConfigSaving(true);
    try {
      // IMPORTANTE: usar dot-notation para no sobreescribir otros campos de whatsappConfig
      await updateDoc(doc(db, "centers", resolvedCenterId), {
        "whatsappConfig.secretaryPhone": botSecretaryPhone.trim(),
      });
      showToast("Configuración del bot guardada correctamente.", "success");
    } catch (e) {
      console.error("save bot config", e);
      showToast("No se pudo guardar la configuración del bot.", "error");
    } finally {
      setBotConfigSaving(false);
    }
  };

  const saveBotApiCredentials = async () => {
    if (!resolvedCenterId) return;
    if (!botPhoneNumberId.trim()) {
      showToast("El Phone Number ID es obligatorio.", "error");
      return;
    }
    setBotApiSaving(true);
    try {
      // Llamar a la Cloud Function que cifra el token antes de guardarlo en Firestore
      const updateConfig = httpsCallable(firebaseFunctions, "updateWhatsappConfig");
      await updateConfig({
        centerId: resolvedCenterId,
        phoneNumberId: botPhoneNumberId.trim(),
        // Solo enviar token si el admin ingresó uno nuevo (no el placeholder)
        accessToken: botAccessToken !== "********" ? botAccessToken.trim() : "********",
      });
      setBotAccessToken("********"); // Enmascarar tras guardado exitoso
      showToast("Credenciales de la API de Meta guardadas y cifradas correctamente. 🔐", "success");
    } catch (e: any) {
      console.error("save bot api credentials", e);
      showToast(e?.message || "No se pudieron guardar las credenciales.", "error");
    } finally {
      setBotApiSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-bold text-white text-2xl flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-emerald-400" /> Plantillas de WhatsApp
            </h3>
            <p className="text-slate-400 mt-2">
              Personaliza los mensajes que se envían desde la ficha clínica.
            </p>
          </div>
          <button
            onClick={addWaTemplate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" /> Nueva Plantilla
          </button>
        </div>

        <WhatsappTemplatesManager
          templates={waTemplates}
          onChange={setWaTemplates}
          onRemove={removeWaTemplate}
          loading={waTemplatesLoading}
        />

        <div className="mt-8 pt-8 border-t border-slate-700 flex justify-end">
          <button
            onClick={saveWaTemplates}
            disabled={waTemplatesSaving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {waTemplatesSaving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>

      {/* BOT CONFIG CARD */}
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xl">Configuración del Bot</h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Número que recibirá notificaciones cuando un paciente solicite hablar con la
              secretaria.
            </p>
          </div>
        </div>

        {botConfigLoading ? (
          <div className="text-slate-400 text-sm italic">Cargando configuración...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                📱 Número de WhatsApp de la Secretaria
              </label>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">
                    +
                  </span>
                  <input
                    type="tel"
                    value={botSecretaryPhone}
                    onChange={(e) =>
                      setBotSecretaryPhone(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="56912345678"
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-7 pr-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
                <button
                  onClick={saveBotConfig}
                  disabled={botConfigSaving}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  {botConfigSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Ingresa el número completo con código de país, sin el símbolo +. Ejemplo:{" "}
                <span className="font-mono text-slate-400">56912345678</span>
              </p>
            </div>

            {botSecretaryPhone && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-emerald-300">
                  Las notificaciones de handoff se enviarán a{" "}
                  <span className="font-mono font-bold">+{botSecretaryPhone}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* META API CONNECTION CARD */}
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 mt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xl">Conexión API de Meta (Número Propio)</h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Vincula tu propio número de WhatsApp Business con el Agente de Clave Salud.
            </p>
          </div>
        </div>

        {/* Step-by-step instructions */}
        <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5 mb-6 mt-4 space-y-3">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3">📋 Pasos para conectar tu número</p>
          <div className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <p className="text-sm text-slate-300">Ve a <span className="font-mono text-indigo-300">developers.facebook.com</span>, crea una App y añade el producto <strong>WhatsApp</strong>.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p className="text-sm text-slate-300">En <strong>WhatsApp → Configuración</strong>, pega esta URL en el campo <em>Callback URL</em> y usa el Verify Token indicado abajo.</p>
          </div>
          <div className="bg-slate-950 border border-slate-600 rounded-xl p-3 ml-9">
            <p className="text-xs text-slate-500 font-mono mb-1">Callback URL (Webhook):</p>
            <div className="flex items-center gap-2">
              <code className="text-indigo-300 text-xs break-all flex-1">https://us-central1-clavesalud-2.cloudfunctions.net/whatsappWebhook</code>
              <button
                onClick={() => { navigator.clipboard.writeText("https://us-central1-clavesalud-2.cloudfunctions.net/whatsappWebhook"); showToast("URL copiada", "info"); }}
                className="p-1.5 bg-slate-700 rounded-lg hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors shrink-0"
                title="Copiar URL"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-2 mb-1">Verify Token:</p>
            <div className="flex items-center gap-2">
              <code className="text-emerald-300 text-xs">CLAVE_SALUD_WHATSAPP_2026</code>
              <button
                onClick={() => { navigator.clipboard.writeText("CLAVE_SALUD_WHATSAPP_2026"); showToast("Verify Token copiado", "info"); }}
                className="p-1.5 bg-slate-700 rounded-lg hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors shrink-0"
                title="Copiar Verify Token"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p className="text-sm text-slate-300">Suscribe el campo <strong>"messages"</strong> en el administrador del webhook. Luego copia el <strong>Phone Number ID</strong> y <strong>Access Token</strong> de larga duración y pégalos abajo.</p>
          </div>
        </div>

        {/* Credential fields */}
        {botConfigLoading ? (
          <div className="text-slate-400 text-sm italic">Cargando configuración...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">🔢 Phone Number ID</label>
              <input
                type="text"
                value={botPhoneNumberId}
                onChange={(e) => setBotPhoneNumberId(e.target.value.trim())}
                placeholder="Ej: 108079568510615"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              <p className="text-xs text-slate-500 mt-1.5">Lo encuentras en el panel de tu App de Meta, bajo <em>WhatsApp → Inicio</em>.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">🔐 Access Token (Token de Acceso)</label>
              <input
                type="password"
                value={botAccessToken}
                onChange={(e) => setBotAccessToken(e.target.value)}
                placeholder={botAccessToken === "********" ? "Token guardado (borrar para reemplazar)" : "Pega aquí el token de larga duración"}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Genera un token de larga duración en tu App de Meta. <span className="text-amber-400 font-semibold">Nunca lo compartas.</span> Se almacena de forma segura y encriptada.
              </p>
            </div>
            {botPhoneNumberId && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-sm text-indigo-300">
                  Phone Number ID configurado: <span className="font-mono font-bold">{botPhoneNumberId}</span>
                </span>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={saveBotApiCredentials}
                disabled={botApiSaving || !botPhoneNumberId.trim()}
                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                {botApiSaving ? "Guardando..." : "Guardar Credenciales"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
