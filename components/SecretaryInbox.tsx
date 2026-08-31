import React, { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { functions } from "../firebase";

type ChatMessage = { role: "patient" | "bot" | "secretary"; text: string; at?: string };
type Conversation = {
  id: string;
  patientName: string;
  patientPhone: string;
  phase: string;
  handoffStatus: string;
  updatedAt?: string | null;
  lastInboundAt?: string | null;
  transcript: ChatMessage[];
  secretaryMessages: ChatMessage[];
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "";

/** Read-only by design: no message is sent from this component. */
const SecretaryInbox: React.FC<{ centerId: string }> = ({ centerId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!centerId) return;
    setLoading(true);
    setError("");
    try {
      const call = httpsCallable<{ centerId: string }, { conversations: Conversation[] }>(
        functions,
        "listSecretaryConversations"
      );
      const result = await call({ centerId });
      const items = result.data.conversations || [];
      setConversations(items);
      setSelectedId((current) => current || items[0]?.id || "");
    } catch (requestError: any) {
      setError(requestError?.message || "No fue posible cargar las conversaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [centerId]);

  const visible = useMemo(
    () =>
      view === "pending"
        ? conversations.filter(
            (item) => item.phase === "HANDOFF" || item.handoffStatus === "pending"
          )
        : conversations,
    [conversations, view]
  );
  const selected =
    visible.find((item) => item.id === selectedId) ||
    conversations.find((item) => item.id === selectedId);
  const messages = useMemo(
    () =>
      [...(selected?.transcript || []), ...(selected?.secretaryMessages || [])].sort((a, b) =>
        String(a.at || "").localeCompare(String(b.at || ""))
      ),
    [selected]
  );

  return (
    <section className="min-h-[560px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
      <header className="flex flex-col gap-3 border-b border-slate-700 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <MessageCircle className="h-5 w-5 text-emerald-400" /> Mensajes de pacientes
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Bandeja de lectura para priorizar solicitudes que el bot derivó a secretaría.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("pending")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === "pending" ? "bg-emerald-600 text-white" : "border border-slate-600 text-slate-200"}`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setView("all")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === "all" ? "bg-emerald-600 text-white" : "border border-slate-600 text-slate-200"}`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        </div>
      </header>
      {error && (
        <p className="m-5 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="grid min-h-[475px] md:grid-cols-[300px_1fr]">
        <aside className="max-h-[560px] overflow-y-auto border-r border-slate-700">
          {loading ? (
            <p className="p-5 text-slate-400">Cargando conversaciones…</p>
          ) : visible.length === 0 ? (
            <p className="p-5 text-slate-400">No hay conversaciones en esta vista.</p>
          ) : (
            visible.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full border-b border-slate-700 p-4 text-left ${item.id === selectedId ? "bg-indigo-950/60" : "hover:bg-slate-700/60"}`}
              >
                <p className="truncate font-semibold text-white">
                  {item.patientName || "Paciente"}
                </p>
                <p className="text-xs text-slate-400">+{item.patientPhone}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(item.updatedAt)}{" "}
                  {item.phase === "HANDOFF" ? "· Solicita secretaría" : ""}
                </p>
              </button>
            ))
          )}
        </aside>
        <main className="flex min-w-0 flex-col">
          {!selected ? (
            <p className="m-auto text-slate-400">Seleccione una conversación.</p>
          ) : (
            <>
              <div className="border-b border-slate-700 p-4">
                <p className="font-semibold text-white">{selected.patientName || "Paciente"}</p>
                <p className="text-sm text-slate-400">+{selected.patientPhone}</p>
              </div>
              <div className="max-h-[420px] flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.at || index}-${index}`}
                    className={`max-w-[85%] rounded-xl p-3 text-sm ${message.role === "patient" ? "bg-slate-700 text-white" : message.role === "secretary" ? "ml-auto bg-emerald-700 text-white" : "ml-auto bg-indigo-900 text-indigo-50"}`}
                  >
                    <p>{message.text}</p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {message.role === "patient"
                        ? "Paciente"
                        : message.role === "secretary"
                          ? "Secretaría"
                          : "Bot"}
                      {message.at ? ` · ${formatDate(message.at)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-1 border-t border-slate-700 p-4 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4" /> Para responder, use el canal oficial y no
                incluya diagnósticos ni antecedentes clínicos.
              </p>
            </>
          )}
        </main>
      </div>
    </section>
  );
};

export default SecretaryInbox;
