import React, { useState } from "react";
import { Doctor, AnyRole, AgendaConfig } from "../types";
import { Plus, Calendar, Trash2, Settings, Save, X, LayoutDashboard, Activity } from "lucide-react";
import { db } from "../firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { generateId } from "../utils";
import { useToast } from "./Toast";

interface ServiceAgendasManagerProps {
  centerId: string;
  doctors: Doctor[];
  onUpdateDoctors: (doctors: Doctor[]) => void;
}

const ServiceAgendasManager: React.FC<ServiceAgendasManagerProps> = ({
  centerId,
  doctors,
  onUpdateDoctors,
}) => {
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Partial<Doctor>>({
    fullName: "",
    specialty: "",
    role: "SERVICIO" as AnyRole,
    active: true,
    visibleInBooking: true,
    agendaConfig: {
      slotDuration: 15,
      startTime: "08:00",
      endTime: "18:00",
    },
  });

  // Filter staff with role "SERVICIO"
  const serviceProfiles = doctors.filter((d) => d.role === "SERVICIO");

  const handleSave = async () => {
    if (!currentProfile.fullName) {
      showToast("El nombre del perfil es requerido.", "warning");
      return;
    }

    try {
      const id = currentProfile.id || `svc_${generateId()}`;
      const staffRef = doc(db, "centers", centerId, "staff", id);

      const payload: any = {
        ...currentProfile,
        id,
        centerId,
        rut: currentProfile.rut || "SERVICIO",
        role: "SERVICIO",
        email: currentProfile.email || `${id}@clavesalud.cl`,
        active: true,
        specialty: currentProfile.specialty || "Servicio / Examen",
      };

      // Remove any potential undefined values that crash Firestore
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(staffRef, payload, { merge: true });

      // Local update
      if (currentProfile.id) {
        onUpdateDoctors(doctors.map((d) => (d.id === id ? payload : d)));
      } else {
        onUpdateDoctors([...doctors, payload]);
      }

      showToast("Perfil de servicio guardado.", "success");
      setIsEditing(false);
      setCurrentProfile({
        fullName: "",
        specialty: "",
        role: "SERVICIO" as AnyRole,
        active: true,
        visibleInBooking: true,
        agendaConfig: {
          slotDuration: 15,
          startTime: "08:00",
          endTime: "18:00",
        },
      });
    } catch (error) {
      console.error("Error saving service profile:", error);
      showToast("Error al guardar el perfil.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm("¿Eliminar este perfil de servicio? Se perderá su configuración de agenda.")
    )
      return;

    try {
      await deleteDoc(doc(db, "centers", centerId, "staff", id));
      onUpdateDoctors(doctors.filter((d) => d.id !== id));
      showToast("Perfil eliminado.", "success");
    } catch (error) {
      showToast("Error al eliminar.", "error");
    }
  };

  return (
    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="font-bold text-white text-2xl flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-amber-400" /> Agendas de Servicios
          </h3>
          <p className="text-slate-400 mt-2">
            Crea perfiles para gestionar cupos de Laboratorio, Imagenología, etc.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-5 h-5" /> Crear Perfil de Agenda
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {serviceProfiles.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
              No hay perfiles de servicio creados aún.
            </div>
          ) : (
            serviceProfiles.map((svc) => (
              <div
                key={svc.id}
                className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 flex justify-between items-center group hover:border-amber-500 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/10">
                    <Calendar className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{svc.fullName}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="font-bold text-amber-500/80">AGENDA HABILITADA</span>
                      <span>•</span>
                      <span>{svc.agendaConfig?.slotDuration} min / cita</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentProfile(svc);
                      setIsEditing(true);
                    }}
                    className="p-2 bg-slate-800 rounded-lg hover:bg-amber-600 text-white transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(svc.id)}
                    className="p-2 bg-slate-800 rounded-lg hover:bg-red-600 text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {isEditing && (
          <div className="bg-slate-900/70 p-6 rounded-2xl border border-amber-500/30 h-fit">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-white text-lg flex items-center gap-2">
                {currentProfile.id ? (
                  <Settings className="w-5 h-5 text-amber-400" />
                ) : (
                  <Plus className="w-5 h-5 text-amber-400" />
                )}
                {currentProfile.id ? "Editar Perfil" : "Nuevo Perfil de Agenda"}
              </h4>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Nombre del Servicio / Recurso
                </label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                  value={currentProfile.fullName || ""}
                  onChange={(e) =>
                    setCurrentProfile({ ...currentProfile, fullName: e.target.value })
                  }
                  placeholder="Ej: Laboratorio de Sangre"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Descripción / Especialidad
                </label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                  value={currentProfile.specialty || ""}
                  onChange={(e) =>
                    setCurrentProfile({ ...currentProfile, specialty: e.target.value })
                  }
                  placeholder="Ej: Toma de Muestras"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Duración Bloque (min)
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                    value={currentProfile.agendaConfig?.slotDuration || 15}
                    onChange={(e) =>
                      setCurrentProfile({
                        ...currentProfile,
                        agendaConfig: {
                          ...currentProfile.agendaConfig!,
                          slotDuration: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Agendamiento Público
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentProfile.visibleInBooking}
                      onChange={(e) =>
                        setCurrentProfile({ ...currentProfile, visibleInBooking: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-xs text-slate-300">Mostrar a pacientes</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Inicia Agenda
                  </label>
                  <input
                    type="time"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                    value={currentProfile.agendaConfig?.startTime || "08:00"}
                    onChange={(e) =>
                      setCurrentProfile({
                        ...currentProfile,
                        agendaConfig: {
                          ...currentProfile.agendaConfig!,
                          startTime: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Termina Agenda
                  </label>
                  <input
                    type="time"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                    value={currentProfile.agendaConfig?.endTime || "18:00"}
                    onChange={(e) =>
                      setCurrentProfile({
                        ...currentProfile,
                        agendaConfig: { ...currentProfile.agendaConfig!, endTime: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-amber-600/20"
              >
                <Save className="w-4 h-4" /> Guardar Perfil de Servicio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceAgendasManager;
