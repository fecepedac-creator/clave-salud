import React, { useEffect, useMemo, useState } from "react";
import { MedicalCenter, Patient, Consultation, Doctor } from "../types";
import { auth, db } from "../firebase";
import { logAccessSafe, logAuditEventSafe, useAuditLog } from "../hooks/useAuditLog";
import FullClinicalRecordPrintView from "./FullClinicalRecordPrintView";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";

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

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Identidad de Género</p>
          <p className="text-sm font-bold text-slate-700">{patient.genderIdentity || "No declarada"}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Previsión de Salud</p>
          <p className="text-sm font-bold text-slate-700">
            {patient.insurance || "No registrada"}
            {patient.insurance === "FONASA" && patient.insuranceLevel && ` (${patient.insuranceLevel})`}
          </p>
        </div>
      </div>

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
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Modo de acceso:
              </span>
              <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border shadow-sm">
                {accessMode === "CARE_TEAM" ? "Equipo tratante" : "Centro completo"}
              </span>
            </div>
            {accessMode === "CARE_TEAM" && (
              <p className="text-[10px] text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded font-semibold">
                Solo el equipo tratante puede acceder a esta ficha.
              </p>
            )}
          </div>

          {showCareTeamEditor && (
            <div className="mt-3 pt-3 border-t border-slate-200/60">
              <p className="text-xs font-bold text-slate-700 mb-2">Equipo tratante</p>
              {accessMode !== "CARE_TEAM" && (
                <p className="text-[10px] text-slate-500 mb-2 leading-tight">
                  En modo centro completo esta asignación es opcional.
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
