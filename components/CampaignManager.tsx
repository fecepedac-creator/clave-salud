import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  where,
  onSnapshot 
} from "firebase/firestore";
import { db } from "../firebase";
import { Patient, WhatsappTemplate } from "../types";
import { 
  Users, 
  MessageSquare, 
  Send, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Clock
} from "lucide-react";

const CampaignManager: React.FC<{ centerId: string }> = ({ centerId }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'no-control'>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!centerId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const pSnap = await getDocs(collection(db, 'centers', centerId, 'patients'));
        setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));

        const tSnap = await getDocs(collection(db, 'centers', centerId, 'whatsappTemplates'));
        setTemplates(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as WhatsappTemplate)));
      } catch (err) {
        console.error("Error loading campaign data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [centerId]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (p.rut && p.rut.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (filterType === 'no-control') {
        // Mock logic: patients without consultations in last 6 months
        return matchesSearch && (!p.consultations || p.consultations.length === 0);
      }
      
      return matchesSearch;
    });
  }, [patients, searchTerm, filterType]);

  const togglePatient = (id: string) => {
    const next = new Set(selectedPatients);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPatients(next);
  };

  const selectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleSendCampaign = async () => {
    setIsSending(true);
    // Simulation of campaign sending
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert(`Campaña lanzada con éxito a ${selectedPatients.size} pacientes.`);
    setIsSending(false);
    setSelectedPatients(new Set());
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-8 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-400" /> Campañas de Marketing IA
          </h2>
          <p className="text-slate-400 text-sm mt-1">Lanza campañas masivas de fidelización y seguimiento activo.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800/80 px-6 py-3 rounded-2xl border border-slate-700">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Audiencia Total</p>
            <p className="text-xl font-black text-white">{patients.length}</p>
          </div>
          <div className="bg-indigo-500/10 px-6 py-3 rounded-2xl border border-indigo-500/30">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Seleccionados</p>
            <p className="text-xl font-black text-white">{selectedPatients.size}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
        {/* Audience Selection */}
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700/50 p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Audiencia de la Campaña
            </h3>
            <button 
              onClick={selectAll}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10"
            >
              {selectedPatients.size === filteredPatients.length ? "Desmarcar Todos" : "Seleccionar Todos"}
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Buscar por nombre o RUT..."
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

          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500 italic text-sm">No se encontraron pacientes para este filtro.</p>
              </div>
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
                      <p className="font-bold text-sm tracking-tight">{p.fullName}</p>
                      <p className="text-[10px] opacity-60 font-mono mt-0.5">{p.rut || "Sin RUT"}</p>
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500 transition-all font-medium"
                >
                  <option value="">Selecciona una plantilla...</option>
                  {templates.filter(t => t.enabled).map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-700 border-dashed relative group">
                  <div className="absolute top-2 right-4 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Vista Previa</span>
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap italic leading-relaxed">
                    {selectedTemplate.body}
                  </p>
                </div>
              )}

              <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-300 leading-normal">
                    Los placeholders como <b>{"{paciente}"}</b> se auto-completarán para cada destinatario de forma individual según la base de datos oficial.
                  </p>
                </div>
              </div>

              <button 
                onClick={handleSendCampaign}
                disabled={isSending || !selectedTemplateId || selectedPatients.size === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {isSending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Procesando...
                  </div>
                ) : (
                  <>
                    <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 
                    Lanzar Campaña
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:scale-110"></div>
            <h4 className="text-sm font-bold text-white mb-4 relative z-10">Consejo de Marketing IA</h4>
            <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 relative z-10">
              <p className="text-xs text-slate-400 leading-relaxed italic">
                "Las campañas enviadas entre las 10:00 y las 11:30 AM tienen un 25% más de tasa de respuesta para controles preventivos."
              </p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-indigo-400 uppercase cursor-pointer hover:gap-2 transition-all">
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
