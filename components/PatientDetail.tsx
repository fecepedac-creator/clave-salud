import React, { useEffect, useMemo, useState } from "react";
import { MedicalCenter, Patient, Consultation, Doctor } from "../types";
import { auth, db } from "../firebase";
import { logAccessSafe, logAuditEventSafe, useAuditLog } from "../hooks/useAuditLog";
import { ChevronDown, FileText, Users } from "lucide-react";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import FullClinicalRecordPrintView from "./FullClinicalRecordPrintView";

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
  const [isCareTeamExpanded, setIsCareTeamExpanded] = useState(false);

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
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleDownload}
        className="flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200 whitespace-nowrap"
      >
        <FileText className="w-4 h-4" />
        Ficha PDF
      </button>

      {/* Basic Info Cards - More compact */}
      <div className="hidden xl:flex items-center gap-2">
        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all hover:bg-slate-50 cursor-default">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Identidad</p>
          <p className="text-[11px] font-bold text-slate-700 leading-none">{patient.genderIdentity || "No declarada"}</p>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all hover:bg-slate-50 cursor-default">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Previsión</p>
          <p className="text-[11px] font-bold text-slate-700 leading-none">
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
        <div className="relative">
          <button
            onClick={() => setIsCareTeamExpanded(!isCareTeamExpanded)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all font-bold text-xs ${isCareTeamExpanded
              ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner"
              : "bg-white border-slate-100 text-slate-600 hover:border-indigo-100 hover:text-indigo-600 shadow-sm"
              }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden lg:inline">Modo: {accessMode === "CARE_TEAM" ? "Equipo" : "Centro"}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isCareTeamExpanded ? "rotate-180" : ""}`} />
          </button>

          {isCareTeamExpanded && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50 animate-scaleIn origin-top-right">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Configurar Acceso</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${accessMode === "CARE_TEAM" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {accessMode === "CARE_TEAM" ? "Restringido" : "Abierto"}
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Equipo tratante asignado:</p>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {staffMembers.map((member) => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border transition-colors cursor-pointer ${careTeamUids.includes(member.id)
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                        : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-white"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={careTeamUids.includes(member.id)}
                        onChange={() => toggleCareTeam(member.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold leading-tight">{member.fullName || member.email}</span>
                        {member.role && (
                          <span className="text-[9px] opacity-70 uppercase font-bold">{member.role}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSaveCareTeam();
                      setIsCareTeamExpanded(false);
                    }}
                    disabled={savingCareTeam}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-100"
                  >
                    {savingCareTeam ? "Guardando..." : "Guardar Cambios"}
                  </button>
                  {accessMode === "CARE_TEAM" && (
                    <p className="text-[9px] text-amber-600 font-bold text-center mt-2 leading-tight">
                      * Solo los seleccionados podrán ver esta ficha.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientDetail;
