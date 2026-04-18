import React, { useMemo, useState } from "react";
import {
  Users,
  Send,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Patient, WhatsappTemplate } from "../types";
import { useToast } from "./Toast";

interface CampaignManagerProps {
  centerId: string;
  centerName: string;
  patients: Patient[];
  templates: WhatsappTemplate[];
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

const CampaignManager: React.FC<CampaignManagerProps> = ({
  centerId,
  centerName,
  patients,
  templates,
}) => {
  const { showToast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "no-control">("all");

  const centerPatients = useMemo(
    () =>
      patients.filter((patient) => {
        const centerIds = Array.isArray(patient.accessControl?.centerIds)
          ? patient.accessControl?.centerIds
          : [];
        return patient.centerId === centerId || centerIds.includes(centerId);
      }),
    [patients, centerId]
  );

  const filteredPatients = useMemo(() => {
    return centerPatients.filter((patient) => {
      const matchesSearch =
        patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(patient.rut || "").includes(searchTerm);

      if (!matchesSearch) return false;
      if (filterType !== "no-control") return true;

      const nextControl = patient.nextControlDate ? new Date(`${patient.nextControlDate}T00:00:00`) : null;
      const lastConsultation = patient.lastConsultationAt
        ? new Date(patient.lastConsultationAt)
        : null;

      if (nextControl && nextControl.getTime() >= Date.now()) return false;
      if (!lastConsultation) return true;
      return Date.now() - lastConsultation.getTime() >= SIX_MONTHS_MS;
    });
  }, [centerPatients, searchTerm, filterType]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

  const togglePatient = (id: string) => {
    const next = new Set(selectedPatients);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPatients(next);
  };

  const handleSelectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set());
      return;
    }
    setSelectedPatients(new Set(filteredPatients.map((patient) => patient.id)));
  };

  const handleSendCampaign = async () => {
    if (!selectedTemplate || selectedPatients.size === 0) return;

    setIsSending(true);
    try {
      const sendCampaign = httpsCallable<
        {
          centerId: string;
          templateId: string;
          templateTitle: string;
          templateBody: string;
          patientIds: string[];
        },
        { ok: boolean; sent: number; skipped: number; requested: number }
      >(getFunctions(), "sendWhatsappCampaign");

      const result = await sendCampaign({
        centerId,
        templateId: selectedTemplate.id,
        templateTitle: selectedTemplate.title,
        templateBody: selectedTemplate.body,
        patientIds: Array.from(selectedPatients),
      });

      const sent = result.data?.sent ?? 0;
      const skipped = result.data?.skipped ?? 0;

      showToast(
        skipped > 0
          ? `Campaña enviada a ${sent} pacientes. ${skipped} contactos quedaron omitidos por teléfono o permisos.`
          : `Campaña enviada a ${sent} pacientes.`,
        skipped > 0 ? "warning" : "success"
      );

      setSelectedPatients(new Set());
      setSelectedTemplateId("");
    } catch (error) {
      console.error("sendWhatsappCampaign", error);
      showToast("No se pudo completar el envío de la campaña.", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Audiencia del centro
              </p>
              <p className="text-2xl font-bold text-white">{centerPatients.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Seleccionados
              </p>
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
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Segmento activo
              </p>
              <p className="text-2xl font-bold text-white">
                {filterType === "all" ? "Todos" : "Sin control"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-400" /> Seleccionar audiencia
              </h3>
              <button
                onClick={handleSelectAll}
                className="text-xs font-bold text-indigo-400 uppercase hover:text-indigo-300"
              >
                {selectedPatients.size === filteredPatients.length && filteredPatients.length > 0
                  ? "Desmarcar todos"
                  : "Marcar todos"}
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
                onChange={(e) => setFilterType(e.target.value as "all" | "no-control")}
                className="bg-slate-900 border border-slate-700 rounded-xl px-4 text-white text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">Todos</option>
                <option value="no-control">Sin control {'>'} 6 meses</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-1">
            {filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm italic">
                No se encontraron pacientes para este filtro.
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => togglePatient(patient.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                    selectedPatients.has(patient.id)
                      ? "bg-indigo-500/10 border-indigo-500/30 text-white"
                      : "bg-transparent border-transparent text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-4 text-left">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        selectedPatients.has(patient.id)
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-700 text-slate-500"
                      }`}
                    >
                      {patient.fullName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{patient.fullName}</p>
                      <p className="text-xs opacity-60">{patient.rut || "Sin RUT"}</p>
                    </div>
                  </div>
                  {selectedPatients.has(patient.id) && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" /> Configuración de envío
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
                  Plantilla activa
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Selecciona una plantilla...</option>
                  {templates
                    .filter((template) => template.enabled)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700 border-dashed">
                  <p className="text-xs text-slate-500 mb-2 uppercase font-bold">
                    Vista previa del mensaje
                  </p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap italic">
                    {selectedTemplate.body
                      .replace(/\{patientName\}/g, "María Pérez")
                      .replace(/\{centerName\}/g, centerName)}
                  </p>
                </div>
              )}

              <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-300 leading-normal">
                    Los placeholders como <b>{"{patientName}"}</b> y <b>{"{centerName}"}</b> se
                    completan automáticamente para cada destinatario.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSendCampaign}
                disabled={isSending || !selectedTemplateId || selectedPatients.size === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {isSending ? (
                  <>Enviando campaña...</>
                ) : (
                  <>
                    <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    Enviar campaña real
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <h4 className="text-sm font-bold text-white mb-4">Consejo de segmentación</h4>
            <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20">
              <p className="text-xs text-slate-400 leading-relaxed italic">
                Usa el segmento “Sin control {'>'} 6 meses” para recordar seguimientos vencidos sin
                mezclar a toda la base de pacientes.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-indigo-400 uppercase">
                Recomendación operativa <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignManager;
