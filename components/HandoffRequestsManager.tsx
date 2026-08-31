import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { CheckCircle2, Clock, RefreshCw, UserCheck } from "lucide-react";
import { functions } from "../firebase";

type HandoffRequest = {
  id: string;
  patientName: string;
  patientPhone: string;
  reason: string;
  status: "pending" | "taken" | "resolved";
  requestedAt?: string | null;
  assignedTo?: string;
};

const HandoffRequestsManager: React.FC<{ centerId: string }> = ({ centerId }) => {
  const [requests, setRequests] = useState<HandoffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!centerId) return;
    setLoading(true);
    setError("");
    try {
      const call = httpsCallable<{ centerId: string }, { requests: HandoffRequest[] }>(
        functions,
        "listSecretaryHandoffs"
      );
      const result = await call({ centerId });
      setRequests(result.data.requests || []);
    } catch (requestError: any) {
      setError(requestError?.message || "No fue posible cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [centerId]);

  const updateStatus = async (requestId: string, status: "taken" | "resolved") => {
    setUpdating(requestId);
    setError("");
    try {
      const call = httpsCallable<
        { centerId: string; requestId: string; status: "taken" | "resolved" },
        { ok: boolean }
      >(functions, "updateSecretaryHandoffStatus");
      await call({ centerId, requestId, status });
      await load();
    } catch (requestError: any) {
      setError(requestError?.message || "No fue posible actualizar la solicitud.");
    } finally {
      setUpdating("");
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <UserCheck className="h-5 w-5 text-indigo-400" /> Solicitudes a secretaría
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Tome y cierre derivaciones del bot. Cada cambio queda auditado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 self-start rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>
      {error && (
        <p className="rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-400">Cargando solicitudes…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-400">No hay solicitudes registradas.</p>
      ) : (
        requests.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-700 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold text-white">{item.patientName || "Paciente"}</p>
              <p className="text-xs text-slate-400">
                +{item.patientPhone || "Sin teléfono"} · {item.reason || "Solicitud general"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.requestedAt
                  ? new Date(item.requestedAt).toLocaleString("es-CL")
                  : "Sin fecha"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {item.status === "pending" && (
                <button
                  type="button"
                  disabled={updating === item.id}
                  onClick={() => void updateStatus(item.id, "taken")}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <UserCheck className="h-4 w-4" /> Tomar
                </button>
              )}
              {item.status !== "resolved" && (
                <button
                  type="button"
                  disabled={updating === item.id}
                  onClick={() => void updateStatus(item.id, "resolved")}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Resolver
                </button>
              )}
              <span className="flex items-center gap-1 text-xs text-amber-300">
                <Clock className="h-4 w-4" />{" "}
                {item.status === "taken"
                  ? "Tomada"
                  : item.status === "resolved"
                    ? "Resuelta"
                    : "Pendiente"}
              </span>
            </div>
          </article>
        ))
      )}
    </section>
  );
};

export default HandoffRequestsManager;
