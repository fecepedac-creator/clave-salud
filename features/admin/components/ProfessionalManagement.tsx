import React, { useState } from "react";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Camera,
  User,
  Briefcase,
  Mail,
  ShieldCheck,
  ImageIcon,
  RefreshCw,
  Check,
  Phone,
} from "lucide-react";
import {
  doc,
  setDoc,
  serverTimestamp,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  AccessRole,
  Capability,
  ClinicalProfession,
  Doctor,
  ProfessionalRole,
  RoleId,
} from "../../../types";
import {
  normalizeRut,
  formatRUT,
  generateId,
  fileToBase64,
  formatPersonName,
} from "../../../utils";
import { useToast } from "../../../components/Toast";
import { PILOT_FEATURES } from "../../../config/pilot";
import {
  adaptLegacyAccess,
  getDefaultCapabilities,
  getGrantableCapabilities,
  normalizeAccessRole,
  normalizeClinicalProfession,
  sanitizeCapabilitiesForAccessRole,
} from "../../../utils/roles";
import { getCreatableClinicalRoleOptions } from "../utils/staffRoleOptions";

const ACCESS_ROLE_LABELS: Record<
  Extract<AccessRole, "center_admin" | "administrative" | "professional">,
  string
> = {
  professional: "Profesional clínico",
  administrative: "Administrativo / recepción",
  center_admin: "Administrador del centro",
};

const CAPABILITY_LABELS: Partial<Record<Capability, string>> = {
  "agenda.read": "Ver agenda",
  "agenda.manage": "Gestionar reservas",
  "agenda.block": "Abrir y cerrar bloques",
  "agenda.override": "Autorizar excepciones de agenda",
  "agenda.contact": "Contactar desde agenda",
  "agenda.check_in": "Registrar llegada",
  "agenda.attendance": "Registrar asistencia",
  "agenda.rebook": "Reagendar citas",
  "operational.export": "Exportar información operativa",
  "patient.demographics.read": "Ver datos demográficos",
  "patient.demographics.write": "Editar datos demográficos",
  "clinical_record.read": "Leer ficha clínica",
  "clinical_draft.create": "Crear borrador clínico",
  "clinical_draft.edit_own": "Editar borradores propios",
  "clinical_record.sign": "Firmar atenciones",
  "clinical_record.addendum": "Agregar adendas",
  "clinical_record.export": "Exportar documentos clínicos",
  "center.configure": "Configurar el centro",
  "users.manage": "Gestionar equipo",
};

const editableDoctor = (doctor: Partial<Doctor>): Partial<Doctor> => {
  const profile = adaptLegacyAccess(doctor);
  const accessRole =
    profile.accessRole === "center_admin" || profile.accessRole === "administrative"
      ? profile.accessRole
      : "professional";
  return {
    ...doctor,
    accessRole,
    clinicalRole: accessRole === "professional" ? profile.clinicalProfession || "MEDICO" : "",
    capabilities: profile.capabilities,
    isAdmin: accessRole === "center_admin",
  };
};

interface ProfessionalManagementProps {
  doctors: Doctor[];
  onUpdateDoctors: (doctors: Doctor[]) => void;
  centerId: string | null;
  activeCenter: any;
  hasActiveCenter: boolean;
  onLogActivity: (log: any) => void;
  ROLE_LABELS: Record<string, string>;
  isSyncingPublic: boolean;
  handleSyncPublicStaff: () => Promise<void>;
  anthropometryEnabled: boolean;
  anthropometrySaving: boolean;
  handleAnthropometryToggle: (enabled: boolean) => void;
  examTimelineMatrixEnabled: boolean;
  examTimelineMatrixSaving: boolean;
  handleExamTimelineMatrixToggle: (enabled: boolean) => void;
  setShowMarketingModal: (show: boolean) => void;
  setMarketingFlyerType: (type: "center" | "professional") => void;
  persistDoctorToFirestore: (doctor: Doctor) => Promise<void>;
}

export const ProfessionalManagement: React.FC<ProfessionalManagementProps> = ({
  doctors,
  onUpdateDoctors,
  centerId,
  hasActiveCenter,
  onLogActivity,
  ROLE_LABELS,
  isSyncingPublic,
  handleSyncPublicStaff,
  anthropometryEnabled,
  anthropometrySaving,
  handleAnthropometryToggle,
  examTimelineMatrixEnabled,
  examTimelineMatrixSaving,
  handleExamTimelineMatrixToggle,
  setShowMarketingModal,
  setMarketingFlyerType,
  persistDoctorToFirestore,
}) => {
  const { showToast } = useToast();
  const [isEditingDoctor, setIsEditingDoctor] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState<Partial<Doctor>>({
    role: "MEDICO" as ProfessionalRole,
    accessRole: "professional",
    clinicalRole: "MEDICO",
    capabilities: getDefaultCapabilities("professional", "MEDICO"),
    visibleInBooking: true,
    active: true,
  });
  const selectedAccessRole = (
    ["center_admin", "administrative", "professional"].includes(String(currentDoctor.accessRole))
      ? currentDoctor.accessRole
      : "professional"
  ) as "center_admin" | "administrative" | "professional";
  const grantableCapabilities = getGrantableCapabilities(selectedAccessRole);

  const upsertStaffAndPublic = async (staffId: string, doctor: Partial<Doctor>) => {
    if (!db || !centerId) return;
    const isTemp = (doctor as any).isTemp ?? false;
    const accessRole = normalizeAccessRole(doctor.accessRole) || "professional";
    const clinicalProfession =
      accessRole === "professional"
        ? normalizeClinicalProfession(doctor.clinicalRole || doctor.role)
        : null;
    const capabilities = sanitizeCapabilitiesForAccessRole(
      accessRole,
      Array.isArray(doctor.capabilities)
        ? doctor.capabilities
        : getDefaultCapabilities(accessRole, clinicalProfession)
    );
    const payload = {
      fullName: doctor.fullName ?? "",
      rut: doctor.rut ?? "",
      email: doctor.email ?? "",
      emailLower: String(doctor.email ?? "").toLowerCase(),
      specialty: doctor.specialty ?? "",
      photoUrl: doctor.photoUrl ?? "",
      agendaConfig: doctor.agendaConfig ?? null,
      role:
        accessRole === "professional"
          ? clinicalProfession || "MEDICO"
          : accessRole === "center_admin"
            ? "ADMIN_CENTRO"
            : "ADMINISTRATIVO",
      accessRole,
      clinicalRole: clinicalProfession || "",
      capabilities,
      visibleInBooking: doctor.visibleInBooking === true,
      active: doctor.active ?? true,
      activo: doctor.active ?? true,
      isTemp,
      phone: (doctor as any).phone ?? "",
      updatedAt: serverTimestamp(),
    } as any;

    await setDoc(doc(db, "centers", centerId, "staff", staffId), payload, { merge: true });
    await setDoc(
      doc(db, "centers", centerId, "publicStaff", staffId),
      {
        id: staffId,
        centerId,
        fullName: payload.fullName,
        specialty: payload.specialty,
        photoUrl: payload.photoUrl,
        role: payload.clinicalRole,
        clinicalRole: payload.clinicalRole,
        agendaConfig: payload.agendaConfig,
        visibleInBooking: payload.visibleInBooking,
        active: payload.active,
        activo: payload.active,
        isTemp,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSaveDoctor = async () => {
    if (!hasActiveCenter) {
      showToast("Selecciona un centro activo para crear profesionales.", "warning");
      return;
    }
    const accessRole = normalizeAccessRole(currentDoctor.accessRole) || "professional";
    const clinicalProfession =
      accessRole === "professional"
        ? normalizeClinicalProfession(currentDoctor.clinicalRole || currentDoctor.role)
        : null;
    if (
      !currentDoctor.fullName ||
      !currentDoctor.rut ||
      !currentDoctor.email ||
      (accessRole === "professional" && !clinicalProfession)
    ) {
      showToast("Por favor complete todos los campos obligatorios.", "error");
      return;
    }

    const capabilities = sanitizeCapabilitiesForAccessRole(
      accessRole,
      Array.isArray(currentDoctor.capabilities)
        ? currentDoctor.capabilities
        : getDefaultCapabilities(accessRole, clinicalProfession)
    );
    const doctorForSave: Partial<Doctor> = {
      ...currentDoctor,
      accessRole,
      clinicalRole: clinicalProfession || "",
      role:
        accessRole === "professional"
          ? clinicalProfession || "MEDICO"
          : accessRole === "center_admin"
            ? "ADMIN_CENTRO"
            : "ADMINISTRATIVO",
      isAdmin: accessRole === "center_admin",
      capabilities,
      visibleInBooking: accessRole === "professional" && currentDoctor.visibleInBooking === true,
    };

    const normalizedRut = normalizeRut(doctorForSave.rut || "");
    const duplicateRut = doctors.find(
      (doctor) => normalizeRut(doctor.rut ?? "") === normalizedRut && doctor.id !== doctorForSave.id
    );
    if (duplicateRut) {
      showToast("Ya existe un profesional con este RUT.", "error");
      return;
    }

    if (doctorForSave.id) {
      // Edit existing staff member
      const updated = doctors.map((d) =>
        d.id === doctorForSave.id ? (doctorForSave as Doctor) : d
      );
      onUpdateDoctors(updated);
      try {
        await upsertStaffAndPublic(doctorForSave.id, doctorForSave);
        showToast("Profesional actualizado.", "success");
      } catch (e: any) {
        console.error("updateStaffDocument", e);
        showToast(e?.message || "No se pudo actualizar el profesional.", "error");
      }
    } else {
      const newDoc: Doctor = {
        ...(doctorForSave as Doctor),
        id: generateId(),
        centerId: centerId!,
        active: true,
        agendaConfig: { slotDuration: 20, startTime: "08:00", endTime: "21:00" },
        clinicalRole: clinicalProfession || "",
        visibleInBooking: accessRole === "professional" && currentDoctor.visibleInBooking === true,
      };

      try {
        await persistDoctorToFirestore(newDoc);
        onUpdateDoctors([...doctors, newDoc]);
        showToast(
          `Profesional ${newDoc.fullName} agregado. Se envió invitación a ${newDoc.email}.`,
          "success"
        );
        onLogActivity({
          action: "STAFF_CREATE",
          entityType: "staff",
          entityId: newDoc.id,
          details: `Agregó profesional ${newDoc.fullName} (${newDoc.email})`,
        });
      } catch (e: any) {
        console.error("persistDoctorToFirestore", e);
        showToast(e?.message || "No se pudo crear el profesional.", "error");
        return;
      }
    }
    setIsEditingDoctor(false);
    setCurrentDoctor({
      role: "MEDICO" as ProfessionalRole,
      accessRole: "professional",
      clinicalRole: "MEDICO",
      capabilities: getDefaultCapabilities("professional", "MEDICO"),
      visibleInBooking: true,
      active: true,
    });
  };

  const handleDeleteDoctor = async (id: string) => {
    if (!db || !centerId) {
      showToast("Error de conexión o centro no identificado.", "error");
      return;
    }

    const doctor = doctors.find((d) => d.id === id);
    if (!doctor) return;

    if (
      !window.confirm(
        `¿Está seguro de eliminar a ${doctor.fullName}? Se desactivará su acceso y se ocultará de la agenda.`
      )
    ) {
      return;
    }

    try {
      const deactivateStaff = httpsCallable(getFunctions(), "deactivateStaff");
      await deactivateStaff({
        centerId,
        staffUid: id,
        reason: `Desactivacion solicitada desde panel: ${doctor.fullName} (${doctor.email || "sin email"})`,
      });
      onUpdateDoctors(doctors.filter((d) => d.id !== id));
      showToast("Profesional eliminado exitosamente.", "success");
      return;

      const staffRef = doc(db, "centers", centerId, "staff", id);
      await setDoc(
        staffRef,
        {
          active: false,
          activo: false,
          visibleInBooking: false,
          updatedAt: serverTimestamp(),
          deletedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "centers", centerId, "publicStaff", id),
        {
          active: false,
          activo: false,
          visibleInBooking: false,
          updatedAt: serverTimestamp(),
          deletedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (doctor.email) {
        const emailLower = doctor.email.toLowerCase();
        const qInv = query(
          collection(db, "invites"),
          where("emailLower", "==", emailLower),
          where("centerId", "==", centerId),
          where("status", "==", "pending")
        );
        const invSnap = await getDocs(qInv);
        for (const invDoc of invSnap.docs) {
          await setDoc(
            doc(db, "invites", invDoc.id),
            {
              status: "revoked",
              revokedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      onUpdateDoctors(doctors.filter((d) => d.id !== id));
      showToast("Profesional eliminado exitosamente.", "success");

      onLogActivity({
        action: "STAFF_DELETE",
        entityType: "staff",
        entityId: id,
        details: `Eliminó profesional ${doctor.fullName} (${doctor.email})`,
      });
    } catch (error) {
      console.error("[handleDeleteDoctor] Error during deletion:", error);
      showToast("No se pudo completar la eliminación en el servidor.", "error");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setCurrentDoctor({ ...currentDoctor, photoUrl: base64 });
      } catch (err) {
        showToast("Error al subir imagen. Use JPG/PNG pequeño.", "error");
      }
    }
  };

  const handleToggleVisibleInBooking = async (docObj: Doctor, visible: boolean) => {
    if (!db || !centerId) return;
    try {
      await upsertStaffAndPublic(docObj.id, { ...docObj, visibleInBooking: visible });
      onUpdateDoctors(
        doctors.map((d) => (d.id === docObj.id ? { ...d, visibleInBooking: visible } : d))
      );
      showToast(
        visible
          ? "Profesional visible en reserva pública."
          : "Profesional oculto en reserva pública.",
        "success"
      );
    } catch (e) {
      showToast("Error al cambiar visibilidad.", "error");
    }
  };

  const getPublicationStatus = (doc: Doctor) => {
    if (doc.active === false) return "Eliminado";
    return doc.visibleInBooking ? "Publicado" : "Oculto";
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Configuración del Centro */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Configuración del Centro</h3>
            <p className="text-sm text-slate-400">
              Controla módulos específicos para el equipo clínico.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleAnthropometryToggle(!anthropometryEnabled)}
            disabled={!hasActiveCenter || anthropometrySaving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${anthropometryEnabled ? "bg-emerald-500" : "bg-slate-600"} ${!hasActiveCenter || anthropometrySaving ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-pressed={anthropometryEnabled}
            aria-label="Activar Antropometría"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${anthropometryEnabled ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-200">Activar Antropometría</p>
            <p className="text-xs text-slate-400">
              Permite registrar peso, talla, IMC y mediciones adicionales.
            </p>
          </div>
          <span
            className={`text-xs font-bold uppercase px-2 py-1 rounded ${anthropometryEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}
          >
            {anthropometryEnabled ? "Activo" : "Inactivo"}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-200">Matriz de exámenes en seguimiento</p>
            <p className="text-xs text-slate-400">
              Muestra resultados por fecha y perfiles clínicos. Se mantiene apagada hasta que el
              centro la habilite.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExamTimelineMatrixToggle(!examTimelineMatrixEnabled)}
            disabled={!hasActiveCenter || examTimelineMatrixSaving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${examTimelineMatrixEnabled ? "bg-emerald-500" : "bg-slate-600"} ${!hasActiveCenter || examTimelineMatrixSaving ? "cursor-not-allowed opacity-50" : ""}`}
            aria-pressed={examTimelineMatrixEnabled}
            aria-label="Activar matriz de exámenes en seguimiento"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${examTimelineMatrixEnabled ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>

        {PILOT_FEATURES.marketing && (
          <>
            {/* Marketing Digital */}
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-200">Marketing Digital</p>
                <p className="text-xs text-slate-400">
                  Crea flyers profesionales para redes sociales con QR de agendamiento.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMarketingFlyerType("center");
                    setShowMarketingModal(true);
                  }}
                  disabled={!hasActiveCenter}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-sm font-semibold">Crear Flyer</span>
                </button>

                <button
                  onClick={handleSyncPublicStaff}
                  disabled={!hasActiveCenter || isSyncingPublic}
                  className={`flex items-center gap-2 px-4 py-2 ${isSyncingPublic ? "bg-slate-700" : "bg-gradient-to-r from-emerald-600 to-teal-600"} text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className={isSyncingPublic ? "animate-spin" : ""}>
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">
                    {isSyncingPublic ? "Sincronizando..." : "Sincronizar Catálogo"}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Listado */}
        <div className="lg:col-span-2 space-y-4">
          {doctors.map((docObj) => (
            <div
              key={docObj.id}
              className="group flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 transition-all hover:border-indigo-500 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl overflow-hidden border-2 ${docObj.isAdmin ? "border-indigo-500" : "border-slate-600"} bg-slate-700`}
                >
                  {docObj.photoUrl ? (
                    <img
                      src={docObj.photoUrl}
                      className="w-full h-full object-cover"
                      alt={docObj.fullName}
                    />
                  ) : (
                    <span className="text-slate-300">{docObj.fullName?.charAt(0) ?? "?"}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    {formatPersonName(docObj.fullName)}
                    {docObj.isAdmin && (
                      <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="bg-slate-900 text-indigo-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-slate-600">
                      {ROLE_LABELS[
                        (docObj.clinicalRole as ProfessionalRole) ||
                          (docObj.role as ProfessionalRole)
                      ] ||
                        docObj.clinicalRole ||
                        docObj.role}
                    </span>
                    <span className="text-slate-500 text-xs font-bold uppercase">
                      • {docObj.specialty}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getPublicationStatus(docObj) === "Publicado" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : getPublicationStatus(docObj) === "Oculto" ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-slate-300 border-slate-500/40 bg-slate-500/10"}`}
                    >
                      {getPublicationStatus(docObj)}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs flex items-center gap-2 mt-1 opacity-70">
                    <Mail className="w-3 h-3" /> {docObj.email}
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 opacity-100 transition-opacity group-hover:opacity-100 sm:w-auto sm:opacity-50">
                <button
                  onClick={() =>
                    handleToggleVisibleInBooking(docObj, !(docObj.visibleInBooking === true))
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-bold ${docObj.visibleInBooking ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
                >
                  {docObj.visibleInBooking ? "Ocultar" : "Publicar"}
                </button>
                <button
                  onClick={() => {
                    setCurrentDoctor(editableDoctor(docObj));
                    setIsEditingDoctor(true);
                  }}
                  className="p-2 bg-slate-700 rounded-lg hover:bg-indigo-600 text-white"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteDoctor(docObj.id)}
                  className="p-2 bg-slate-700 rounded-lg hover:bg-red-600 text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Formulario */}
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 h-fit sticky top-24">
          <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-2">
            {isEditingDoctor ? (
              <Edit className="w-5 h-5 text-indigo-400" />
            ) : (
              <Plus className="w-5 h-5 text-indigo-400" />
            )}
            {isEditingDoctor ? "Editar Profesional" : "Nuevo Profesional"}
          </h3>

          <div className="flex justify-center mb-6">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-600 bg-slate-700 flex items-center justify-center">
                {currentDoctor.photoUrl ? (
                  <img
                    src={currentDoctor.photoUrl}
                    className="w-full h-full object-cover"
                    alt="preview"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-500" />
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer text-white font-bold text-xs flex-col gap-1">
                <Camera className="w-6 h-6" />
                Cambiar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Tipo de acceso</label>
              <div className="relative">
                <select
                  aria-label="Tipo de acceso del miembro"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500 appearance-none font-medium"
                  value={selectedAccessRole}
                  onChange={(event) => {
                    const accessRole = event.target.value as typeof selectedAccessRole;
                    const clinicalProfession = normalizeClinicalProfession(
                      currentDoctor.clinicalRole || currentDoctor.role
                    );
                    setCurrentDoctor({
                      ...currentDoctor,
                      accessRole,
                      role:
                        accessRole === "professional"
                          ? clinicalProfession || "MEDICO"
                          : accessRole === "center_admin"
                            ? "ADMIN_CENTRO"
                            : "ADMINISTRATIVO",
                      clinicalRole:
                        accessRole === "professional" ? clinicalProfession || "MEDICO" : "",
                      isAdmin: accessRole === "center_admin",
                      visibleInBooking:
                        accessRole === "professional" && currentDoctor.visibleInBooking === true,
                      capabilities: getDefaultCapabilities(
                        accessRole,
                        accessRole === "professional" ? clinicalProfession || "MEDICO" : null
                      ),
                    });
                  }}
                >
                  {Object.entries(ACCESS_ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <Briefcase className="absolute right-3 top-3 w-5 h-5 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {selectedAccessRole === "professional" && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Profesión clínica
                </label>
                <div className="relative">
                  <select
                    aria-label="Profesión clínica"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500 appearance-none font-medium"
                    value={currentDoctor.clinicalRole || "MEDICO"}
                    onChange={(event) => {
                      const clinicalRole = event.target.value as ClinicalProfession;
                      setCurrentDoctor({
                        ...currentDoctor,
                        role: clinicalRole,
                        clinicalRole,
                        capabilities: getDefaultCapabilities("professional", clinicalRole),
                      });
                    }}
                  >
                    {getCreatableClinicalRoleOptions(ROLE_LABELS).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Briefcase className="absolute right-3 top-3 w-5 h-5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                value={currentDoctor.fullName || ""}
                onChange={(e) => setCurrentDoctor({ ...currentDoctor, fullName: e.target.value })}
                placeholder="Ej: Dr. Juan Pérez"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">RUT</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                value={currentDoctor.rut || ""}
                onChange={(e) =>
                  setCurrentDoctor({ ...currentDoctor, rut: formatRUT(e.target.value) })
                }
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Especialidad</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                value={currentDoctor.specialty || ""}
                onChange={(e) => setCurrentDoctor({ ...currentDoctor, specialty: e.target.value })}
                placeholder="Ej: Cardiología, General..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Email (Login)</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
                type="email"
                value={currentDoctor.email || ""}
                onChange={(e) => setCurrentDoctor({ ...currentDoctor, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                WhatsApp (sin + ni espacios)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">
                  +
                </span>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-3 text-white font-mono text-sm outline-none focus:border-emerald-500"
                  type="tel"
                  value={(currentDoctor as any).phone || ""}
                  onChange={(e) =>
                    setCurrentDoctor({
                      ...currentDoctor,
                      phone: e.target.value.replace(/[^0-9]/g, ""),
                    } as any)
                  }
                  placeholder="56912345678"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Necesario para que el profesional consulte su agenda vía WhatsApp.
              </p>
            </div>

            <fieldset className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <legend className="px-1 text-xs font-bold uppercase text-slate-400">
                Capacidades de esta membresía
              </legend>
              <p className="mb-3 text-xs text-slate-500">
                Se aplican al centro actual y nunca se derivan de la profesión.
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {grantableCapabilities.map((capability) => {
                  const checked = (currentDoctor.capabilities || []).includes(capability);
                  return (
                    <label
                      key={capability}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-500"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const requested = event.target.checked
                            ? [...(currentDoctor.capabilities || []), capability]
                            : (currentDoctor.capabilities || []).filter(
                                (item) => item !== capability
                              );
                          setCurrentDoctor({
                            ...currentDoctor,
                            capabilities: sanitizeCapabilitiesForAccessRole(
                              selectedAccessRole,
                              requested
                            ),
                          });
                        }}
                      />
                      <span>{CAPABILITY_LABELS[capability] || capability}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {selectedAccessRole === "professional" && (
              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentDoctor.visibleInBooking ? "bg-emerald-900/20 border-emerald-500" : "bg-slate-900 border-slate-700 hover:border-slate-500"}`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentDoctor.visibleInBooking ? "bg-emerald-500 border-emerald-500" : "border-slate-500"}`}
                >
                  {currentDoctor.visibleInBooking && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={currentDoctor.visibleInBooking || false}
                  onChange={(e) =>
                    setCurrentDoctor({ ...currentDoctor, visibleInBooking: e.target.checked })
                  }
                />
                <div>
                  <span className="block font-bold text-white text-sm">Visible para pacientes</span>
                  <span className="block text-xs text-slate-400">
                    Controla si aparece en la agenda pública.
                  </span>
                </div>
              </label>
            )}

            <div className="flex gap-3 mt-6">
              {isEditingDoctor && (
                <button
                  onClick={() => {
                    setIsEditingDoctor(false);
                    setCurrentDoctor({
                      role: "MEDICO" as ProfessionalRole,
                      accessRole: "professional",
                      clinicalRole: "MEDICO",
                      capabilities: getDefaultCapabilities("professional", "MEDICO"),
                      visibleInBooking: true,
                      active: true,
                    });
                  }}
                  className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSaveDoctor}
                disabled={!hasActiveCenter}
                title={hasActiveCenter ? "Guardar profesional" : "Selecciona un centro activo"}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditingDoctor ? "Guardar Cambios" : "Crear Profesional"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
