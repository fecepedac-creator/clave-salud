import React from "react";
import { Preadmission, Doctor } from "../../../types";
import { Check, User, Phone, Tag } from "lucide-react";
import Button from "../../../components/ui/Button";

export interface PreadmissionListProps {
  preadmissions: Preadmission[];
  doctors: Doctor[];
  onApprove: (item: Preadmission) => void;
}

const PreadmissionList: React.FC<PreadmissionListProps> = ({
  preadmissions,
  doctors,
  onApprove,
}) => {
  if (preadmissions.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 text-center">
        <p className="text-slate-500 italic">No hay preingresos pendientes.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        Solicitudes de Preingreso
      </h3>
      <div className="space-y-4">
        {preadmissions.map((item) => {
          const doc = doctors.find((d) => d.id === item.doctorId);
          const patientName = item.contact?.name || item.patientDraft?.fullName || "Paciente";
          const patientRut = item.contact?.rut || item.patientDraft?.rut || "N/A";
          const patientPhone = item.contact?.phone || item.patientDraft?.phone || "N/A";

          return (
            <div
              key={item.id}
              className="p-6 rounded-2xl bg-slate-900/40 border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-500/30 transition-all group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">
                      {patientName}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {patientRut}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {patientPhone}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wider">
                    Asignado: {doc?.fullName || "Médico no asignado"}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => onApprove(item)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 py-3 md:py-2"
              >
                <Check className="w-4 h-4 mr-2" /> Aprobar Preingreso
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PreadmissionList;
