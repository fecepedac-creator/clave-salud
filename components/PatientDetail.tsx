import React, { useEffect, useMemo, useState } from "react";
import { MedicalCenter, Patient, Consultation, Doctor, PatientCommunication } from "../types";
import { auth, db } from "../firebase";
import { logAccessSafe, logAuditEventSafe, useAuditLog } from "../hooks/useAuditLog";
import FullClinicalRecordPrintView from "./FullClinicalRecordPrintView";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { withDefaultPatientCommunication } from "../utils/patientCommunication";

interface GeneratedByInfo {
  name: string;
  rut?: string;
  role?: string;
}

interface PatientDetailProps {
  patient: Patient | null;
  centerId?: string;
  center?: MedicalCenter | null;
  consultations?: Consultation[];
  generatedBy?: GeneratedByInfo;
  onUpdatePatient?: (patient: Patient) => void;
}

const PatientDetail: React.FC<PatientDetailProps> = ({
  patient,
  centerId,
  center,
  consultations = [],
  generatedBy,
  onUpdatePatient,
}) => {
  const { logAccess } = useAuditLog();
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedConsultations, setSelectedConsultations] = useState<Consultation[]>([]);
  const [staffMembers, setStaffMembers] = useState<Doctor[]>([]);
  const [careTeamUids, setCareTeamUids] = useState<string[]>(patient?.careTeamUids ?? []);
  const [savingCareTeam, setSavingCareTeam] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [communication, setCommunication] = useState<PatientCommunication>(
    withDefaultPatientCommunication(patient ?? {}).communication
  );
  const [savingCommunication, setSavingCommunication] = useState(false);

  useEffect(() => {
    if (!patient || !centerId) return;
    logAccessSafe(logAccess, {
      centerId,
      resourceType: "patient",
      resourcePath: `/centers/${centerId}/patients/${patient.id}`,
      patientId: patient.id,
      actorUid: auth.currentUser?.uid ?? undefined,
    });
  }, [centerId, logAccess, patient]);

  useEffect(() => {
    setCareTeamUids(patient?.careTeamUids ?? []);
  }, [patient?.careTeamUids, patient?.id]);

  useEffect(() => {
    setCommunication(withDefaultPatientCommunication(patient ?? {}).communication);
  }, [patient?.id, patient?.communication]);

  useEffect(() => {
    const loadStaff = async () => {
      if (!centerId) return;
      try {
        const snap = await getDocs(collection(db, "centers", centerId, "staff"));
        const list = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Doctor));
        const activeList = list.filter(
          (member) => (member as any).active !== false && (member as any).activo !== false
        );
        setStaffMembers(activeList);
      } catch (error) {
        console.error("load staff for care team", error);
      }
    };
    loadStaff();
  }, [centerId]);

  useEffect(() => {
    let mounted = true;
    const resolveAdmin = async () => {
      const uid = auth.currentUser?.uid;
      const staff = staffMembers.find((member) => member.id === uid);
      const staffAdmin =
        staff?.isAdmin === true || String(staff?.role || "").toLowerCase() === "center_admin";
      let superAdminClaim = false;
      try {
        const token = await auth.currentUser?.getIdTokenResult();
        superAdminClaim =
          token?.claims?.super_admin === true ||
          token?.claims?.superadmin === true ||
          token?.claims?.superAdmin === true;
      } catch (error) {
        console.warn("resolve admin claims", error);
      }
      if (mounted) setIsAdminUser(Boolean(staffAdmin || superAdminClaim));
    };
    resolveAdmin();
    return () => {
      mounted = false;
    };
  }, [staffMembers]);

  const filteredConsultations = useMemo(() => {
    const activeOnly = (consultations || []).filter((c) => c.active !== false);
    return activeOnly.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [consultations]);

  const handleDownload = () => {
    if (!patient) return;
    const total = filteredConsultations.length;
    let toExport = filteredConsultations;
    if (total > 50) {
      const exportAll = window.confirm(
        "Este paciente tiene muchas atenciones. ¿Deseas exportar todo? (puede tardar)\n\nAceptar: Exportar TODO\nCancelar: Exportar últimas 20"
      );
      toExport = exportAll ? filteredConsultations : filteredConsultations.slice(0, 20);
    }
    setSelectedConsultations(toExport);
    setIsPrintOpen(true);
  };

  if (!patient) return null;

  const accessMode = center?.accessMode ?? "CENTER_WIDE";
  const showCareTeamEditor = isAdminUser;

  const toggleCareTeam = (uid: string) => {
    setCareTeamUids((prev) =>
      prev.includes(uid) ? prev.filter((item) => item !== uid) : [...prev, uid]
    );
  };


  const toggleCommunication = (channel: "email" | "whatsapp", field: "consent" | "optedOut") => {
    setCommunication((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: !prev[channel][field],
      },
    }));
  };

  const handleSaveCommunication = async () => {
    if (!centerId || !patient) return;
    setSavingCommunication(true);
    try {
      const now = serverTimestamp();
      const nextCommunication = {
        email: { ...communication.email, updatedAt: now },
        whatsapp: { ...communication.whatsapp, updatedAt: now },
      };
      await updateDoc(doc(db, "centers", centerId, "patients", patient.id), {
        communication: nextCommunication,
        lastUpdated: new Date().toISOString(),
      });
      onUpdatePatient?.({ ...patient, communication });
      await logAuditEventSafe({
        centerId,
        action: "PATIENT_UPDATE",
        entityType: "patient",
        entityId: patient.id,
        patientId: patient.id,
        details: "Actualización de consentimiento y opt-out por canal.",
        metadata: { communication },
      });
    } catch (error) {
      console.error("save communication", error);
    } finally {
      setSavingCommunication(false);
    }
  };

  const handleSaveCareTeam = async () => {
    if (!centerId || !patient) return;
    setSavingCareTeam(true);
    try {
      await updateDoc(doc(db, "centers", centerId, "patients", patient.id), {
        careTeamUids,
        careTeamUpdatedAt: serverTimestamp(),
        careTeamUpdatedBy: auth.currentUser?.uid ?? "unknown",
      });
      onUpdatePatient?.({ ...patient, careTeamUids });
      await logAuditEventSafe({
        centerId,
        action: "CARE_TEAM_UPDATE",
        entityType: "patient",
        entityId: patient.id,
        patientId: patient.id,
        details: "Actualización de equipo tratante.",
        metadata: { careTeamCount: careTeamUids.length },
      });
    } catch (error) {
      console.error("save care team", error);
    } finally {
      setSavingCareTeam(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        className="bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
      >
        Descargar ficha completa (PDF)
      </button>

      <FullClinicalRecordPrintView
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        patient={patient}
        center={center ?? null}
        consultations={selectedConsultations}
        generatedAt={new Date().toISOString()}
        generatedBy={generatedBy}
      />

      {isAdminUser && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                Modo de acceso
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {accessMode === "CARE_TEAM" ? "Equipo tratante" : "Centro completo"}
              </p>
            </div>
            {accessMode === "CARE_TEAM" && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-semibold">
                Solo el equipo tratante podrá acceder a esta ficha.
              </p>
            )}
          </div>


          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-sm font-bold text-slate-700 mb-1">Consentimiento de comunicación</p>
            <p className="text-xs text-slate-500 mb-3">
              Default seguro: si no existe configuración previa, marketing queda no consentido; transaccional
              solo se bloquea cuando el paciente marca opt-out por canal.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["email", "whatsapp"] as const).map((channel) => (
                <div key={channel} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700 capitalize">{channel}</p>
                  <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={communication[channel].consent}
                      onChange={() => toggleCommunication(channel, "consent")}
                    />
                    Consentimiento marketing
                  </label>
                  <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={communication[channel].optedOut}
                      onChange={() => toggleCommunication(channel, "optedOut")}
                    />
                    Opt-out (bloquear envíos)
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSaveCommunication}
              disabled={savingCommunication}
              className="mt-3 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {savingCommunication ? "Guardando..." : "Guardar comunicación"}
            </button>
          </div>

          {showCareTeamEditor && (
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-700 mb-2">Equipo tratante</p>
              {accessMode !== "CARE_TEAM" && (
                <p className="text-xs text-slate-500 mb-3">
                  En modo centro completo esta asignación es opcional, pero quedará lista si luego
                  activas el acceso restringido.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {staffMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={careTeamUids.includes(member.id)}
                      onChange={() => toggleCareTeam(member.id)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{member.fullName || member.email}</span>
                    {member.role && (
                      <span className="text-xs text-slate-400">({member.role})</span>
                    )}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveCareTeam}
                disabled={savingCareTeam}
                className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingCareTeam ? "Guardando..." : "Guardar equipo tratante"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PatientDetail;
