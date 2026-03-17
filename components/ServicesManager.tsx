import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  Check,
  Info,
  Activity,
  FlaskConical,
  Image as ImageIcon,
  HeartPulse,
  Stethoscope,
  Upload,
  FileText,
} from "lucide-react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { MedicalService } from "../types";
import { generateId, fileToBase64 } from "../utils";
import { useToast } from "./Toast";

interface ServicesManagerProps {
  centerId: string;
}

const CATEGORY_LABELS = {
  LABORATORY: {
    label: "Laboratorio",
    icon: FlaskConical,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  IMAGING: {
    label: "Imagenología",
    icon: ImageIcon,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  CARDIOLOGY: {
    label: "Cardiología",
    icon: HeartPulse,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  PROCEDURE: {
    label: "Procedimiento",
    icon: Stethoscope,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  OTHER: { label: "Otro", icon: Activity, color: "text-slate-400", bg: "bg-slate-500/10" },
};

const PREDEFINED_BUNDLES = [
  {
    id: "lab_basic",
    title: "Pack Laboratorio",
    icon: FlaskConical,
    color: "text-blue-400",
    description: "Hemograma, Perfil Bioquímico, Orina, Glucosa, etc.",
    category: "LABORATORY",
    services: [
      { name: "Hemograma Completo", price: 15000, duration: 15 },
      { name: "Perfil Bioquímico (12 parámetros)", price: 25000, duration: 15 },
      { name: "Orina Completa", price: 8000, duration: 15 },
      { name: "Glicemia en ayunas", price: 5000, duration: 15 },
      { name: "Perfil Lipídico", price: 12000, duration: 15 },
      { name: "Creatinina plasmática", price: 6000, duration: 15 },
    ],
  },
  {
    id: "cardio_basic",
    title: "Pack Cardiología",
    icon: HeartPulse,
    color: "text-red-400",
    description: "Electro, Holter Arritmia, MAPA, Ecocardio.",
    category: "CARDIOLOGY",
    services: [
      { name: "Electrocardiograma (ECG)", price: 20000, duration: 20 },
      { name: "Ecocardiograma Doppler Color", price: 65000, duration: 30 },
      { name: "Holter de Arritmia (24 hrs)", price: 45000, duration: 20 },
      { name: "Monitoreo Ambulatorio de P/A (MAPA)", price: 45000, duration: 20 },
      { name: "Test de Esfuerzo", price: 55000, duration: 45 },
    ],
  },
  {
    id: "imaging_basic",
    title: "Pack Imagenología",
    icon: ImageIcon,
    color: "text-purple-400",
    description: "Ecografías y Radiografías comunes.",
    category: "IMAGING",
    services: [
      { name: "Ecografía Abdominal", price: 35000, duration: 20 },
      { name: "Ecografía Renal y Vesical", price: 30000, duration: 20 },
      { name: "Ecografía de Partes Blandas", price: 28000, duration: 20 },
      { name: "Radiografía de Tórax (AP y Lat)", price: 22000, duration: 15 },
      { name: "Radiografía de Extremidades", price: 18000, duration: 15 },
    ],
  },
];

const ServicesManager: React.FC<ServicesManagerProps> = ({ centerId }) => {
  const [services, setServices] = useState<MedicalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<MedicalService>>({
    name: "",
    category: "LABORATORY",
    price: 0,
    description: "",
    preparationInstructions: "",
    durationMinutes: 20,
    isActive: true,
    active: true,
    isAgendable: true,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("El archivo es muy pesado (máx 2MB).", "warning");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setCurrentService({
        ...currentService,
        instructionsFile: base64,
        instructionsFileName: file.name,
      });
      showToast("Archivo de instrucciones cargado.", "success");
    } catch (error) {
      showToast("Error al procesar el archivo.", "error");
    }
  };

  const { showToast } = useToast();

  useEffect(() => {
    if (!centerId) return;

    const q = query(collection(db, "centers", centerId, "services"), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as MedicalService
        );
        setServices(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading services:", error);
        showToast("Error al cargar las prestaciones.", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [centerId]);

  const handleSave = async () => {
    if (!currentService.name) {
      showToast("El nombre es requerido.", "error");
      return;
    }

    try {
      const id = currentService.id || generateId();
      const serviceRef = doc(db, "centers", centerId, "services", id);

      const payload: any = {
        ...currentService,
        id,
        active: currentService.isActive ?? true,
        updatedAt: serverTimestamp(),
        createdAt: currentService.id ? currentService.createdAt : serverTimestamp(),
      };

      // Firebase throws INTERNAL ASSERTION FAILED if we pass undefined values
      if (payload.instructionsFile === undefined) delete payload.instructionsFile;
      if (payload.instructionsFileName === undefined) delete payload.instructionsFileName;
      if (payload.preparationInstructions === undefined) payload.preparationInstructions = "";

      await setDoc(serviceRef, payload, { merge: true });
      showToast(
        `Prestación ${currentService.id ? "actualizada" : "creada"} correctamente.`,
        "success"
      );
      setIsEditing(false);
      setCurrentService({
        name: "",
        category: "LABORATORY",
        price: 0,
        description: "",
        preparationInstructions: "",
        durationMinutes: 20,
        isActive: true,
        active: true,
        isAgendable: true,
      });
    } catch (error) {
      console.error("Error saving service:", error);
      showToast("Error al guardar la prestación.", "error");
    }
  };

  const handleActivateBundle = async (bundle: (typeof PREDEFINED_BUNDLES)[0]) => {
    if (
      !window.confirm(
        `¿Desea cargar automáticamente el ${bundle.title}? Se añadirán ${bundle.services.length} prestaciones base.`
      )
    )
      return;

    try {
      setLoading(true);
      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);

      bundle.services.forEach((s) => {
        const id = `pre_${generateId()}`;
        const serviceRef = doc(db, "centers", centerId, "services", id);
        const payload: MedicalService = {
          id,
          name: s.name,
          category: bundle.category as any,
          price: s.price,
          durationMinutes: s.duration,
          active: true,
          isActive: true,
          isAgendable: true,
          preparationInstructions: "",
          description: `Carga automática de ${bundle.title}`,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
        };
        batch.set(serviceRef, payload);
      });

      await batch.commit();
      showToast(`${bundle.title} activado correctamente.`, "success");
    } catch (error) {
      console.error("Error activating bundle:", error);
      showToast("Error al activar el pack de servicios.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Está seguro de eliminar esta prestación?")) return;

    try {
      await deleteDoc(doc(db, "centers", centerId, "services", id));
      showToast("Prestación eliminada.", "success");
    } catch (error) {
      console.error("Error deleting service:", error);
      showToast("Error al eliminar la prestación.", "error");
    }
  };

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-bold text-white text-2xl flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-400" /> Catálogo de Prestaciones
            </h3>
            <p className="text-slate-400 mt-2">
              Administra los exámenes, procedimientos y servicios del centro.
            </p>
          </div>
          <button
            onClick={() => {
              setCurrentService({
                name: "",
                category: "LABORATORY",
                price: 0,
                description: "",
                preparationInstructions: "",
                durationMinutes: 20,
                isActive: true,
              });
              setIsEditing(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" /> Nueva Prestación
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre o categoría..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Quick Start Wizard Toggle (when services exist) */}
        {services.length > 0 && !loading && (
          <div className="mb-6">
            <button
              onClick={() => setShowQuickStart(!showQuickStart)}
              className="text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus
                className={`w-4 h-4 transition-transform ${showQuickStart ? "rotate-45" : ""}`}
              />
              {showQuickStart ? "Ocultar Módulos Rápidos" : "Cargar Módulos Predefinidos (Packs)"}
            </button>
          </div>
        )}

        {/* Quick Start Wizard */}
        {(services.length === 0 || showQuickStart) && !loading && (
          <div className="mb-8 p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl animate-pulse-subtle">
            <div className="flex items-center gap-3 mb-4">
              <Plus className="w-5 h-5 text-indigo-400" />
              <h4 className="font-bold text-white">Configuración Rápida</h4>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Activa módulos predefinidos con los exámenes más comunes para comenzar de inmediato.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PREDEFINED_BUNDLES.map((bundle) => {
                const Icon = bundle.icon;
                return (
                  <button
                    key={bundle.id}
                    onClick={() => handleActivateBundle(bundle)}
                    className="flex flex-col items-start p-4 bg-slate-900/50 border border-slate-700 rounded-xl hover:border-indigo-500 transition-all text-left group"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-slate-800 group-hover:bg-indigo-500/10 transition-colors`}
                    >
                      <Icon className={`w-5 h-5 ${bundle.color}`} />
                    </div>
                    <h5 className="font-bold text-white text-sm mb-1">{bundle.title}</h5>
                    <p className="text-[10px] text-slate-500 leading-tight">{bundle.description}</p>
                    <div className="mt-3 text-[10px] font-bold text-indigo-400 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Activar ahora <Plus className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* List */}
          <div className="space-y-4">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Cargando prestaciones...</div>
            ) : filteredServices.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
                No se encontraron prestaciones.
              </div>
            ) : (
              filteredServices.map((service) => {
                const CatInfo =
                  CATEGORY_LABELS[service.category as keyof typeof CATEGORY_LABELS] ||
                  CATEGORY_LABELS.OTHER;
                const Icon = CatInfo.icon;

                return (
                  <div
                    key={service.id}
                    className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex justify-between items-center group hover:border-indigo-500 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${CatInfo.bg}`}
                      >
                        <Icon className={`w-6 h-6 ${CatInfo.color}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{service.name}</h4>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${CatInfo.color}`}>{CatInfo.label}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-emerald-400 font-bold">
                            ${(service.price || 0).toLocaleString("es-CL")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setCurrentService(service);
                          setIsEditing(true);
                        }}
                        className="p-2 bg-slate-800 rounded-lg hover:bg-indigo-600 text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="p-2 bg-slate-800 rounded-lg hover:bg-red-600 text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Editor Sidebar */}
          {isEditing ? (
            <div className="bg-slate-900/70 p-6 rounded-2xl border border-indigo-500/30 h-fit sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-white text-lg flex items-center gap-2">
                  {currentService.id ? (
                    <Edit className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Plus className="w-5 h-5 text-indigo-400" />
                  )}
                  {currentService.id ? "Editar Prestación" : "Nueva Prestación"}
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
                    value={currentService.name || ""}
                    onChange={(e) => setCurrentService({ ...currentService, name: e.target.value })}
                    placeholder="Ej: Hemograma Completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
                      value={currentService.category}
                      onChange={(e) =>
                        setCurrentService({ ...currentService, category: e.target.value as any })
                      }
                    >
                      {Object.entries(CATEGORY_LABELS).map(([key, info]) => (
                        <option key={key} value={key}>
                          {info.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Precio ($)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500"
                      value={currentService.price || 0}
                      onChange={(e) =>
                        setCurrentService({ ...currentService, price: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Instrucciones de Preparación
                  </label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 text-sm"
                    placeholder="Ayuno, vestimenta, etc."
                    value={currentService.preparationInstructions || ""}
                    onChange={(e) =>
                      setCurrentService({
                        ...currentService,
                        preparationInstructions: e.target.value,
                      })
                    }
                  />
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Estas instrucciones las leerá el Bot de WhatsApp.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Descripción (Interna)
                  </label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 text-sm"
                    value={currentService.description || ""}
                    onChange={(e) =>
                      setCurrentService({ ...currentService, description: e.target.value })
                    }
                  />
                </div>

                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-3">
                    Documento de Preparación (PDF/Imagen)
                  </label>
                  {currentService.instructionsFile ? (
                    <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 p-2 rounded-lg">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-xs text-indigo-200 truncate">
                          {currentService.instructionsFileName || "instrucciones.pdf"}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setCurrentService({
                            ...currentService,
                            instructionsFile: undefined,
                            instructionsFileName: undefined,
                          })
                        }
                        className="p-1 hover:bg-indigo-500/20 rounded"
                      >
                        <X className="w-4 h-4 text-indigo-400" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-4 hover:border-indigo-500 transition-colors cursor-pointer group">
                      <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 mb-2" />
                      <span className="text-xs text-slate-500 group-hover:text-slate-300">
                        Cargar preparación
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>

                <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-500 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={currentService.isAgendable ?? true}
                    onChange={(e) =>
                      setCurrentService({ ...currentService, isAgendable: e.target.checked })
                    }
                    className="w-4 h-4 accent-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-white">Habilitar Agenda</span>
                    <span className="block text-[10px] text-slate-500 text-xs italic">
                      Permite agendar horas para este servicio.
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Guardar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700 text-slate-500">
              <Activity className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-center text-sm">
                Selecciona una prestación para editarla o crea una nueva.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServicesManager;
