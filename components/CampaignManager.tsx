import React, { useState, useEffect, useContext } from "react";
import { 
  Users, 
  Send, 
  MessageSquare, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronRight
} from "lucide-react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  onSnapshot 
} from "firebase/firestore";
import { Patient, WhatsappTemplate } from "../types";
import { CenterContext } from "../CenterContext";
import { useToast } from "./Toast";

const CampaignManager: React.FC = () => {
  const { activeCenterId } = useContext(CenterContext);
  const { showToast } = useToast();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "no-control">("all");

  // Cargar Plantillas
  useEffect(() => {
    if (!activeCenterId) return;
    const docRef = doc(db, "centers", activeCenterId, "settings", "whatsapp");
    return onSnapshot(docRef, (snap) => {
      const data = snap.data();
      setTemplates(data?.templates || []);
    });
  }, [activeCenterId]);

  // Cargar Pacientes
  const loadPatients = async () => {
    if (!activeCenterId) return;
    setIsLoading(true);
    try {
      // Nota: En un sistema real, filtraríamos por pacientes del centro
      // Aquí usamos la colección global filtrada por acceso (simplificado)
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
      setPatients(data);
    } catch (error) {
      showToast("Error al cargar pacientes.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [activeCenterId]);

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.rut?.includes(searchTerm);
    // Lógica de filtro "Sin Control" (Simplificada para demo: pacientes creados hace > 6 meses)
    if (filterType === "no-control") {
      // Placeholder: Implementar lógica real con fechas de última cita
    }
    return matchesSearch;
  });

  const togglePatient = (id: string) => {
    const next = new Set(selectedPatients);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPatients(next);
  };

  const handleSelectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleSendCampaign = async () => {
    if (!selectedTemplateId || selectedPatients.size === 0) return;
    
    setIsSending(true);
    try {
      // Simulación de envío masivo vía Cloud Function
      showToast(`Enviando campaña a ${selectedPatients.size} pacientes...`, "info");
      
      // Aquí llamaríamos a httpsCallable(functions, 'sendBulkWhatsApp')
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showToast("Campaña enviada con éxito.", "success");
      setSelectedPatients(new Set());
      setSelectedTemplateId("");
    } catch (error) {
      showToast("Error al procesar el envío.", "error");
    } finally {
      setIsSending(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Audiencia Total</p>
              <p className="text-2xl font-bold text-white">{patients.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Seleccionados</p>
              <p className="text-2xl font-bold text-white">{selectedPatients.size}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tasa de Apertura Est.</p>
              <p className="text-2xl font-bold text-white">85%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Selection List */}
        <div className="lg:col-span-2 bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-400" /> Seleccionar Audiencia
              </h3>
              <button 
                onClick={handleSelectAll}
                className="text-xs font-bold text-indigo-400 uppercase hover:text-indigo-300"
              >
                {selectedPatients.size === filteredPatients.length ? "Desmarcar Todos" : "Marcar Todos"}
              </button>
            </div>
            
            <div className="mt-4 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Buscar pacientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-4 text-white text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">Todos</option>
                <option value="no-control">Sin Control {" > "} 6 meses</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-1">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">Cargando lista de pacientes...</div>
            ) : filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm italic">No se encontraron pacientes para este filtro.</div>
            ) : (
              filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePatient(p.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                    selectedPatients.has(p.id) 
                      ? "bg-indigo-500/10 border-indigo-500/30 text-white" 
                      : "bg-transparent border-transparent text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      selectedPatients.has(p.id) ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-500"
                    }`}>
                      {p.fullName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{p.fullName}</p>
                      <p className="text-xs opacity-60">{p.rut || "Sin RUT"}</p>
                    </div>
                  </div>
                  {selectedPatients.has(p.id) && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Campaign Settings */}
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" /> Configuración de Envío
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Mensaje Sugerido</label>
                <select 
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Selecciona una plantilla...</option>
                  {templates.filter(t => t.enabled).map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700 border-dashed">
                  <p className="text-xs text-slate-500 mb-2 uppercase font-bold">Vista Previa del Mensaje</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap italic">
                    {selectedTemplate.body}
                  </p>
                </div>
              )}

              <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-300 leading-normal">
                    Los placeholders como <b>{"{paciente}"}</b> se auto-completarán para cada destinatario de forma individual según la base de datos.
                  </p>
                </div>
              </div>

              <button 
                onClick={handleSendCampaign}
                disabled={isSending || !selectedTemplateId || selectedPatients.size === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {isSending ? (
                  <>Procesando...</>
                ) : (
                  <>
                    <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 
                    Lanzar Campaña
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <h4 className="text-sm font-bold text-white mb-4">Consejo de Marketing IA</h4>
            <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20">
              <p className="text-xs text-slate-400 leading-relaxed italic">
                "Las campañas enviadas entre las 10:00 y las 11:30 AM tienen un 25% más de tasa de respuesta para controles preventivos."
              </p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-indigo-400 uppercase">
                Ver más sugerencias <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignManager;
