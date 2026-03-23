import React from "react";
import { Megaphone, Mail } from "lucide-react";
import { MedicalCenter } from "../../../types";

export type NotificationType = "billing" | "incident" | "security" | "info";
export type NotificationSeverity = "low" | "medium" | "high";

interface SuperAdminCommunicationsProps {
  centers: MedicalCenter[];
  commCenterId: string;
  setCommCenterId: (val: string) => void;
  commCenter: any;
  commType: NotificationType;
  setCommType: (val: NotificationType) => void;
  commSeverity: NotificationSeverity;
  setCommSeverity: (val: NotificationSeverity) => void;
  selectedTemplate: string;
  handleApplyTemplate: (val: string) => void;
  commTitle: string;
  setCommTitle: (val: string) => void;
  commBody: string;
  setCommBody: (val: string) => void;
  commSendEmail: boolean;
  setCommSendEmail: (val: boolean) => void;
  handleSendNotification: () => void;
  emailTemplate: string;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  buildGmailComposeUrl: (to: string, sub: string, bdy: string) => string;
  commHistoryLoading: boolean;
  commHistory: any[];
}

export const SuperAdminCommunications: React.FC<SuperAdminCommunicationsProps> = ({
  centers,
  commCenterId,
  setCommCenterId,
  commCenter,
  commType,
  setCommType,
  commSeverity,
  setCommSeverity,
  selectedTemplate,
  handleApplyTemplate,
  commTitle,
  setCommTitle,
  commBody,
  setCommBody,
  commSendEmail,
  setCommSendEmail,
  handleSendNotification,
  emailTemplate,
  showToast,
  buildGmailComposeUrl,
  commHistoryLoading,
  commHistory,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Comunicación</h1>
        <p className="text-slate-500">
          Avisos a administradores (registro local) + plantilla de correo.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-400 uppercase">Centro</span>
              <select
                className="w-full p-3 border rounded-xl bg-white"
                value={commCenterId}
                onChange={(e) => setCommCenterId(e.target.value)}
              >
                <option value="">-- Seleccionar centro --</option>
                {centers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-400 mt-1">
                Admin:{" "}
                {commCenter?.adminEmail
                  ? commCenter.adminEmail
                  : "— (configúralo en Centros)"}
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Tipo</span>
                <select
                  className="w-full p-3 border rounded-xl bg-white"
                  value={commType}
                  onChange={(e) => setCommType(e.target.value as NotificationType)}
                >
                  <option value="billing">Cobranza / Facturación</option>
                  <option value="incident">Incidencia / Servicio</option>
                  <option value="security">Seguridad</option>
                  <option value="info">Información</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Severidad</span>
                <select
                  className="w-full p-3 border rounded-xl bg-white"
                  value={commSeverity}
                  onChange={(e) => setCommSeverity(e.target.value as NotificationSeverity)}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-400 uppercase">
                Plantilla Predefinida
              </span>
              <select
                className="w-full p-3 border rounded-xl bg-white"
                value={selectedTemplate}
                onChange={(e) => handleApplyTemplate(e.target.value)}
              >
                <option value="">-- Seleccionar plantilla (opcional) --</option>
                <option value="cobranza">Cobranza - Recordatorio de pago</option>
                <option value="info">Información general</option>
                <option value="fiesta">Saludo por fiestas</option>
                <option value="bienvenida">Bienvenida a nuevos centros</option>
                <option value="mantenimiento">Mantenimiento programado</option>
              </select>
              <div className="text-xs text-slate-400 mt-1">
                Seleccione una plantilla para autocompletar título y mensaje. Puede editarlos
                después.
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-400 uppercase">Título</span>
              <input
                className="w-full p-3 border rounded-xl"
                value={commTitle}
                onChange={(e) => setCommTitle(e.target.value)}
                placeholder="Ej: Pago vencido — regularizar para mantener continuidad"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-400 uppercase">Mensaje</span>
              <textarea
                className="w-full p-3 border rounded-xl min-h-[140px]"
                value={commBody}
                onChange={(e) => setCommBody(e.target.value)}
                placeholder="Describe la situación, plazos y canal de contacto..."
              />
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
              <input
                type="checkbox"
                checked={commSendEmail}
                onChange={(e) => setCommSendEmail(e.target.checked)}
                className="w-5 h-5 accent-indigo-600"
              />
              <div>
                <span className="block font-bold text-slate-700">
                  Generar plantilla para email
                </span>
                <span className="text-xs text-slate-400">
                  Envío real por correo: idealmente Cloud Function.
                </span>
              </div>
            </label>

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow inline-flex items-center gap-2"
                onClick={handleSendNotification}
              >
                <Megaphone className="w-5 h-5" /> Enviar aviso
              </button>

              <button
                type="button"
                className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow inline-flex items-center gap-2"
                onClick={() => {
                  navigator.clipboard?.writeText(emailTemplate);
                  showToast("Plantilla de correo copiada", "success");
                }}
              >
                <Mail className="w-5 h-5" /> Copiar email
              </button>

              {commCenter?.adminEmail && commTitle && commBody && (
                <button
                  type="button"
                  className="px-5 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow inline-flex items-center gap-2"
                  onClick={() => {
                    const adminEmail = commCenter.adminEmail?.trim() || "";
                    const centerName = commCenter.name || "Centro";
                    const subject =
                      commType === "billing"
                        ? `ClaveSalud — Aviso de facturación (${centerName})`
                        : commType === "incident"
                          ? `ClaveSalud — Incidencia operativa (${centerName})`
                          : commType === "security"
                            ? `ClaveSalud — Aviso de seguridad (${centerName})`
                            : `ClaveSalud — Información (${centerName})`;
                    const body = `Hola,\n\n${commTitle}\n\n${commBody}\n\n—\nPor favor, si necesitas soporte o más información, responde este correo.\n\n— Equipo ClaveSalud`;
                    const gmailUrl = buildGmailComposeUrl(adminEmail, subject, body);
                    window.open(gmailUrl, "_blank");
                  }}
                >
                  <Mail className="w-5 h-5" /> Abrir en Gmail
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                Vista previa (email)
              </div>
              <pre className="whitespace-pre-wrap text-xs text-slate-700 bg-white border rounded-xl p-3 min-h-[200px]">
                {emailTemplate}
              </pre>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                Historial (centro)
              </div>
              {commHistoryLoading ? (
                <div className="text-sm text-slate-500">Cargando historial...</div>
              ) : commHistory.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No hay avisos registrados para este centro.
                </div>
              ) : (
                <div className="space-y-2">
                  {commHistory.slice(0, 10).map((n: any) => (
                    <div key={n.id} className="bg-white border rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-slate-800 text-sm">{n.title}</div>
                        <span className="text-[11px] text-slate-400">
                          {n.createdAtISO ? new Date(n.createdAtISO).toLocaleString() : "—"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                          {n.type}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                          {n.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">
                          {n.sendEmail ? "con email" : "solo interno"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
