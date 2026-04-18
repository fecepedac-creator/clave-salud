import React from "react";
import { Building2, Plus, Edit, Trash2, Save } from "lucide-react";
import { MedicalCenter } from "../../../types";
import { ROLE_CATALOG } from "../../../constants";
import { httpsCallable, getFunctions } from "firebase/functions";

type PlanKey = "trial" | "basic" | "pro" | "enterprise";
type BillingStatus = "paid" | "due" | "overdue" | "grace" | "suspended";

type BillingInfo = {
  plan?: PlanKey;
  monthlyUF?: number;
  billingStatus?: BillingStatus;
  nextDueDate?: string;
  lastPaidAt?: string;
  notes?: string;
};

type CenterExt = MedicalCenter & {
  adminEmail?: string;
  billing?: BillingInfo;
  logoUrl?: string;
};

interface SuperAdminCentersProps {
  centers: MedicalCenter[];
  editingCenter: CenterExt | null;
  setEditingCenter: (c: CenterExt | null) => void;
  isCreating: boolean;
  setIsCreating: (c: boolean) => void;
  handleStartCreate: () => void;
  handleSaveCenter: () => void;
  handleDeleteCenter: (id: string) => void;
  isUploadingLogo: boolean;
  logoPreview: string;
  setLogoPreview: (s: string) => void;
  logoFile: File | null;
  setLogoFile: (f: File | null) => void;
  resetLogoState: () => void;
  marketingSettings: any;
  setMarketingSettings: React.Dispatch<React.SetStateAction<any>>;
  marketingSaving: boolean;
  handleSaveMarketingSettings: () => void;
  isInvitingAdmin: boolean;
  setIsInvitingAdmin: (b: boolean) => void;
  handleInviteCenterAdmin: () => void;
  lastInviteLink: string;
  setLastInviteLink: (s: string) => void;
  lastInviteTo: string;
  setLastInviteTo: (s: string) => void;
  lastInviteSubject: string;
  setLastInviteSubject: (s: string) => void;
  lastInviteBody: string;
  setLastInviteBody: (s: string) => void;
  invitesLoading: boolean;
  centerInvites: any[];
  hasMoreCenters: boolean;
  onLoadMoreCenters?: () => void;
  isLoadingMoreCenters: boolean;
  newCenterName: string;
  setNewCenterName: (s: string) => void;
  newCenterSlug: string;
  setNewCenterSlug: (s: string) => void;
  newCenterAdminEmail: string;
  setNewCenterAdminEmail: (s: string) => void;
  renderBadge: (status?: BillingStatus) => React.ReactNode;
  renderHealthBadge: (center: CenterExt) => React.ReactNode;
  buildGmailComposeUrl: (to: string, subject: string, body: string) => string;
  buildCopyEmailText: (to: string, subject: string, body: string) => string;
  showToast: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  fetchCenterInvites: (centerId: string) => Promise<void>;
}

export const SuperAdminCenters: React.FC<SuperAdminCentersProps> = ({
  centers,
  editingCenter,
  setEditingCenter,
  isCreating,
  setIsCreating,
  handleStartCreate,
  handleSaveCenter,
  handleDeleteCenter,
  isUploadingLogo,
  logoPreview,
  setLogoPreview,
  logoFile,
  setLogoFile,
  resetLogoState,
  marketingSettings,
  setMarketingSettings,
  marketingSaving,
  handleSaveMarketingSettings,
  isInvitingAdmin,
  setIsInvitingAdmin,
  handleInviteCenterAdmin,
  lastInviteLink,
  setLastInviteLink,
  lastInviteTo,
  setLastInviteTo,
  lastInviteSubject,
  setLastInviteSubject,
  lastInviteBody,
  setLastInviteBody,
  invitesLoading,
  centerInvites,
  hasMoreCenters,
  onLoadMoreCenters,
  isLoadingMoreCenters,
  newCenterName,
  setNewCenterName,
  newCenterSlug,
  setNewCenterSlug,
  newCenterAdminEmail,
  setNewCenterAdminEmail,
  renderBadge,
  renderHealthBadge,
  buildGmailComposeUrl,
  buildCopyEmailText,
  showToast,
  fetchCenterInvites,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Gestión de Centros</h1>
          <p className="text-slate-500">Crear/editar centros, módulos, cupos y adminEmail.</p>
        </div>

        {!editingCenter && (
          <button
            onClick={handleStartCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-5 h-5" /> Crear Centro
          </button>
        )}
      </div>

      {!editingCenter ? (
        <div className="grid gap-4">
          {centers.map((c0) => {
            const center = c0 as CenterExt;
            const billing = (center as any).billing as BillingInfo | undefined;
            return (
              <div
                key={center.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-700 flex-shrink-0 border border-slate-200 overflow-hidden">
                  {center.logoUrl ? (
                    <img
                      src={center.logoUrl}
                      alt={center.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-800">{center.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (center as any).active !== false && (center as any).isActive !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {(center as any).active !== false && (center as any).isActive !== false
                        ? "Activo"
                        : "Suspendido"}
                    </span>
                    {renderBadge(billing?.billingStatus)}
                    {renderHealthBadge(center)}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {(billing?.plan || "trial").toUpperCase()}
                    </span>
                  </div>

                  <div className="text-sm text-slate-500 mt-1">
                    <span className="font-mono bg-slate-100 px-1 rounded">/{center.slug}</span>
                    {" • "}maxUsers: {(center as any).maxUsers ?? 0}
                    {" • "}Admin: {(center as any).adminEmail ? (center as any).adminEmail : "—"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetLogoState();
                      setEditingCenter(center);
                      setIsCreating(false);

                      // limpiar invitación previa al entrar a editar
                      setLastInviteLink("");
                      setLastInviteTo("");
                      setLastInviteSubject("");
                      setLastInviteBody("");
                    }}
                    className="p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-600 transition-colors"
                    title="Editar centro"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Estás SEGURO de eliminar el centro "${center.name}"?\n\nESTA ACCIÓN ES IRREVERSIBLE.\nSe recomienda usar "Desactivar" en su lugar.`
                        )
                      ) {
                        handleDeleteCenter(center.id);
                      }
                    }}
                    className="p-3 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 transition-colors"
                    title="Eliminar centro"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
          {centers.length === 0 && (
            <p className="text-center py-10 text-slate-400 font-bold">
              No hay centros creados aún.
            </p>
          )}
          {hasMoreCenters && (
            <div className="flex justify-center">
              <button
                type="button"
                className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-60"
                disabled={isLoadingMoreCenters}
                onClick={() => onLoadMoreCenters?.()}
              >
                {isLoadingMoreCenters ? "Cargando..." : "Cargar más centros"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              {isCreating ? "Crear Nuevo Centro" : "Editar Centro"}
            </h2>
            <div className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">
              ID: {editingCenter.id || "NUEVO"}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Datos Principales
                </div>

                {isCreating ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Nombre</span>
                      <input
                        className="w-full p-3 border rounded-xl"
                        value={newCenterName}
                        onChange={(e) => setNewCenterName(e.target.value)}
                        placeholder="Ej. Clínica San Miguel"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Slug</span>
                      <input
                        className="w-full p-3 border rounded-xl"
                        value={newCenterSlug}
                        onChange={(e) => setNewCenterSlug(e.target.value)}
                        placeholder="san-miguel"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Admin Email (primer admin)
                      </span>
                      <input
                        className="w-full p-3 border rounded-xl"
                        value={newCenterAdminEmail}
                        onChange={(e) => setNewCenterAdminEmail(e.target.value)}
                        placeholder="admin@centro.cl"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Nombre</span>
                      <input
                        className="w-full p-3 border rounded-xl"
                        value={editingCenter.name}
                        onChange={(e) =>
                          setEditingCenter({ ...editingCenter, name: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">Slug</span>
                      <input
                        className="w-full p-3 border rounded-xl"
                        value={editingCenter.slug}
                        onChange={(e) =>
                          setEditingCenter({ ...editingCenter, slug: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Admin Email
                      </span>
                      <input
                        className="w-full p-3 border rounded-xl"
                        value={(editingCenter as any).adminEmail || ""}
                        onChange={(e) =>
                          setEditingCenter({
                            ...(editingCenter as any),
                            adminEmail: e.target.value,
                          })
                        }
                        placeholder="admin@centro.cl"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Logo */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Logo del centro
                </div>
                <div className="text-sm text-slate-600">
                  Sube un logo (SVG, PNG, JPG, WEBP, máx. 2MB).
                  <p className="mt-1 text-[11px] text-slate-500 italic">
                    💡 Tip: Se recomienda usar <b>SVG</b> o <b>PNG con transparencia</b>. Los logos
                    vectoriales (SVG) mantienen la nitidez en cualquier tamaño.
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    id="logo-input"
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                    disabled={isUploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];

                      if (logoPreview) {
                        try {
                          URL.revokeObjectURL(logoPreview);
                        } catch {}
                      }

                      if (!f) {
                        setLogoFile(null);
                        setLogoPreview("");
                        return;
                      }

                      if (f.size > 2 * 1024 * 1024) {
                        showToast("Archivo muy grande. Máximo 2MB.", "error");
                        e.target.value = "";
                        setLogoFile(null);
                        setLogoPreview("");
                        return;
                      }

                      setLogoFile(f);
                      setLogoPreview(URL.createObjectURL(f));
                    }}
                  />

                  {(logoPreview || (editingCenter as any)?.logoUrl) && (
                    <div className="flex items-center gap-3 mt-3">
                      <img
                        src={logoPreview || (editingCenter as any).logoUrl}
                        alt="Previsualización del logo"
                        className="w-20 h-20 rounded-xl object-contain border-2 border-slate-200 bg-white p-2"
                      />
                      <button
                        type="button"
                        className="text-sm font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
                        disabled={isUploadingLogo}
                        onClick={() => {
                          setLogoFile(null);
                          if (logoPreview) {
                            try {
                              URL.revokeObjectURL(logoPreview);
                            } catch {}
                          }
                          setLogoPreview("");

                          setEditingCenter({ ...(editingCenter as any), logoUrl: "" });

                          const fileInput = document.getElementById(
                            "logo-input"
                          ) as HTMLInputElement | null;
                          if (fileInput) fileInput.value = "";
                        }}
                      >
                        Quitar logo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Marketing settings */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Marketing RRSS
                </div>
                <div className="space-y-4">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      Marketing habilitado
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={marketingSettings.enabled}
                      onChange={(e) =>
                        setMarketingSettings((prev: any) => ({
                          ...prev,
                          enabled: e.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-400 uppercase">
                      Límite mensual de afiches
                    </span>
                    <input
                      type="number"
                      min={-1}
                      max={999}
                      className="w-full p-3 border rounded-xl mt-1"
                      value={marketingSettings.monthlyPosterLimit}
                      onChange={(e) =>
                        setMarketingSettings((prev: any) => ({
                          ...prev,
                          monthlyPosterLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Usa -1 para ilimitado. 0 desactiva la generación.
                    </p>
                  </label>

                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      Permitir guardar afiches por 7 días
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={marketingSettings.allowPosterRetention}
                      onChange={(e) =>
                        setMarketingSettings((prev: any) => ({
                          ...prev,
                          allowPosterRetention: e.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-400 uppercase">
                      Retención fija (días)
                    </span>
                    <input
                      type="number"
                      className="w-full p-3 border rounded-xl mt-1 bg-slate-100 text-slate-500"
                      value={7}
                      disabled
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveMarketingSettings}
                    disabled={marketingSaving}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-60"
                  >
                    {marketingSaving ? "Guardando..." : "Guardar marketing"}
                  </button>
                </div>
              </div>

              {/* ✅ INVITAR ADMIN: mailto + Gmail */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Invitar administrador
                </div>
                <div className="text-sm text-slate-600">
                  Genera un enlace seguro (token) para que el administrador cree su contraseña.
                  Expira en 7 días.
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                    disabled={isInvitingAdmin}
                    onClick={handleInviteCenterAdmin}
                  >
                    {isInvitingAdmin ? "Generando..." : "Generar invitación y abrir correo"}
                  </button>

                  {/* ✅ Botones adicionales solo si ya existe una invitación generada */}
                  {lastInviteLink && lastInviteTo && lastInviteSubject && lastInviteBody && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
                        onClick={() =>
                          window.open(
                            buildGmailComposeUrl(lastInviteTo, lastInviteSubject, lastInviteBody),
                            "_blank"
                          )
                        }
                        title="Abrir Gmail web con el correo prellenado"
                      >
                        Abrir en Gmail
                      </button>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-white border text-slate-900 font-bold text-sm hover:bg-slate-50"
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            buildCopyEmailText(lastInviteTo, lastInviteSubject, lastInviteBody)
                          );
                          showToast("Correo completo copiado.", "success");
                        }}
                      >
                        Copiar correo
                      </button>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-white border text-slate-900 font-bold text-sm hover:bg-slate-50"
                        onClick={async () => {
                          await navigator.clipboard.writeText(lastInviteLink);
                          showToast("Enlace copiado.", "success");
                        }}
                      >
                        Copiar enlace
                      </button>
                    </div>
                  )}

                  {lastInviteLink && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Enlace</div>
                      <div className="text-sm text-slate-700 break-all">{lastInviteLink}</div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500">
                    Requisito: el centro debe estar guardado y tener <b>adminEmail</b>.
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                      Invitaciones recientes
                    </div>
                    {invitesLoading ? (
                      <div className="text-sm text-slate-500">Cargando invitaciones...</div>
                    ) : centerInvites.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        No hay invitaciones recientes para este centro.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {centerInvites.slice(0, 5).map((inv) => (
                          <div
                            key={inv.id}
                            className="bg-white border rounded-xl p-3 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-bold text-slate-800">
                                {inv.emailLower}
                              </div>
                              <span className="text-[11px] text-slate-400 uppercase font-bold">
                                {inv.status || "pending"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Expira:{" "}
                              {inv.expiresAt?.toDate
                                ? inv.expiresAt.toDate().toLocaleString()
                                : "—"}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                                onClick={async () => {
                                  const fn = httpsCallable(
                                    getFunctions(),
                                    "resendCenterAdminInvite"
                                  );
                                  const res: any = await fn({ token: inv.id });
                                  const data = res?.data || {};
                                  if (data?.inviteUrl) {
                                    const centerName = String(inv.centerName || "Centro");
                                    const subject = `Invitación a ClaveSalud - Administración del centro (${centerName})`;
                                    const body = [
                                      "Hola,",
                                      "",
                                      `Te reenviamos tu invitación para administrar ${centerName}.`,
                                      "",
                                      `Enlace: ${String(data.inviteUrl)}`,
                                      "",
                                      "Equipo ClaveSalud",
                                    ].join("\n");
                                    setLastInviteLink(String(data.inviteUrl));
                                    setLastInviteTo(String(inv.emailLower || ""));
                                    setLastInviteSubject(subject);
                                    setLastInviteBody(body);
                                  }
                                  showToast(
                                    data?.emailSent
                                      ? "Invitación reenviada por correo."
                                      : "Invitación regenerada. Comparte el nuevo enlace manualmente.",
                                    data?.emailSent ? "success" : "warning"
                                  );
                                  await fetchCenterInvites(inv.centerId);
                                }}
                              >
                                Reenviar
                              </button>
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg bg-white border text-slate-700 text-xs font-bold hover:bg-slate-50"
                                onClick={async () => {
                                  if (!window.confirm("¿Revocar invitación?")) return;
                                  const fn = httpsCallable(getFunctions(), "revokeCenterInvite");
                                  await fn({ token: inv.id });
                                  showToast("Invitación revocada.", "success");
                                  await fetchCenterInvites(inv.centerId);
                                }}
                              >
                                Revocar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Roles permitidos */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Roles permitidos
                </div>
                <div className="text-sm text-slate-600 mb-3">
                  Define qué perfiles puede crear el centro. Se guarda como IDs estables (ej:
                  MEDICO, ENFERMERA).
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ROLE_CATALOG.filter((r) => r.id !== "ADMIN_CENTRO").map((r) => {
                    const selected = Array.isArray((editingCenter as any).allowedRoles)
                      ? (editingCenter as any).allowedRoles.includes(r.id)
                      : false;
                    return (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const curr: string[] = Array.isArray(
                              (editingCenter as any).allowedRoles
                            )
                              ? [...(editingCenter as any).allowedRoles]
                              : [];
                            const next = e.target.checked
                              ? Array.from(new Set([...curr, r.id]))
                              : curr.filter((x) => x !== r.id);
                            setEditingCenter({
                              ...(editingCenter as any),
                              allowedRoles: next,
                            });
                          }}
                          className="w-5 h-5 accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-700">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Nota: el rol "Administrador del Centro" se asigna por invitación/alta y no se
                  controla aquí.
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">maxUsers</span>
                <input
                  type="number"
                  className="w-full p-3 border rounded-xl"
                  value={(editingCenter as any).maxUsers ?? 0}
                  onChange={(e) =>
                    setEditingCenter({
                      ...(editingCenter as any),
                      maxUsers: Number(e.target.value),
                    })
                  }
                />
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
                <input
                  type="checkbox"
                  checked={!!((editingCenter as any).active ?? (editingCenter as any).isActive)}
                  onChange={(e) =>
                    setEditingCenter({
                      ...(editingCenter as any),
                      active: e.target.checked,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-indigo-600"
                />
                <div>
                  <span className="block font-bold text-slate-700">Centro activo</span>
                  <span className="text-xs text-slate-400">
                    Si está desactivado, el centro queda suspendido.
                  </span>
                </div>
              </label>
            </div>

            {/* Columna derecha: módulos + billing rápido */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Módulos</div>

                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border mb-2">
                  <input
                    type="checkbox"
                    checked={!!(editingCenter as any).modules?.agenda}
                    onChange={(e) =>
                      setEditingCenter({
                        ...(editingCenter as any),
                        modules: {
                          ...((editingCenter as any).modules || {}),
                          agenda: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="font-semibold text-slate-700">Agenda</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border mb-2">
                  <input
                    type="checkbox"
                    checked={!!(editingCenter as any).modules?.prescriptions}
                    onChange={(e) =>
                      setEditingCenter({
                        ...(editingCenter as any),
                        modules: {
                          ...((editingCenter as any).modules || {}),
                          prescriptions: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="font-semibold text-slate-700">Recetas</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                  <input
                    type="checkbox"
                    checked={!!(editingCenter as any).modules?.dental}
                    onChange={(e) =>
                      setEditingCenter({
                        ...(editingCenter as any),
                        modules: {
                          ...((editingCenter as any).modules || {}),
                          dental: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="font-semibold text-slate-700">Dental</span>
                </label>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Plan / Facturación (rápido)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Plan</span>
                    <select
                      className="w-full p-3 border rounded-xl bg-white"
                      value={((editingCenter as any).billing?.plan || "trial") as PlanKey}
                      onChange={(e) =>
                        setEditingCenter({
                          ...(editingCenter as any),
                          billing: {
                            ...((editingCenter as any).billing || {}),
                            plan: e.target.value as PlanKey,
                          },
                        })
                      }
                    >
                      <option value="trial">Trial</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">UF / mes</span>
                    <input
                      type="number"
                      className="w-full p-3 border rounded-xl"
                      value={Number((editingCenter as any).billing?.monthlyUF || 0)}
                      onChange={(e) =>
                        setEditingCenter({
                          ...(editingCenter as any),
                          billing: {
                            ...((editingCenter as any).billing || {}),
                            monthlyUF: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Estado</span>
                    <select
                      className="w-full p-3 border rounded-xl bg-white"
                      value={
                        ((editingCenter as any).billing?.billingStatus || "due") as BillingStatus
                      }
                      onChange={(e) =>
                        setEditingCenter({
                          ...(editingCenter as any),
                          billing: {
                            ...((editingCenter as any).billing || {}),
                            billingStatus: e.target.value as BillingStatus,
                          },
                        })
                      }
                    >
                      <option value="paid">Al día</option>
                      <option value="due">Por vencer</option>
                      <option value="grace">Gracia</option>
                      <option value="overdue">Atrasado</option>
                      <option value="suspended">Suspendido</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      Próximo venc.
                    </span>
                    <input
                      type="date"
                      className="w-full p-3 border rounded-xl"
                      value={String((editingCenter as any).billing?.nextDueDate || "")}
                      onChange={(e) =>
                        setEditingCenter({
                          ...(editingCenter as any),
                          billing: {
                            ...((editingCenter as any).billing || {}),
                            nextDueDate: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Tip: puedes ajustar también desde la pestaña Finanzas.
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-end pt-6 border-t mt-8">
            <button
              onClick={() => setEditingCenter(null)}
              className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveCenter}
              className="px-8 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg flex items-center gap-2"
            >
              <Save className="w-5 h-5" /> {isUploadingLogo ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
