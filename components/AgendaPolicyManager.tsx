import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { AgendaPolicy, normalizeAgendaPolicy } from "../domain/agendaPolicy";

const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `agenda_policy_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function AgendaPolicyManager({ centerId }: { centerId: string }) {
  const [policy, setPolicy] = useState<AgendaPolicy>(() =>
    normalizeAgendaPolicy(centerId, "default", null)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewSignature, setPreviewSignature] = useState("");
  const requestIdRef = useRef(newRequestId());

  useEffect(() => {
    let active = true;
    setLoading(true);
    httpsCallable(
      functions,
      "getAgendaPolicy"
    )({ centerId, locationId: "default" })
      .then((response) => {
        if (active) {
          setPolicy(
            normalizeAgendaPolicy(centerId, "default", response.data as Partial<AgendaPolicy>)
          );
        }
      })
      .catch(() => {
        if (active) setMessage("No fue posible cargar la política de agenda.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [centerId]);

  const update = <K extends keyof AgendaPolicy>(key: K, value: AgendaPolicy[K]) => {
    setPreviewSignature("");
    setMessage("");
    requestIdRef.current = newRequestId();
    setPolicy((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const signature = JSON.stringify(policy);
      if (previewSignature !== signature) {
        const preview = await httpsCallable(
          functions,
          "previewAgendaPolicyImpact"
        )({ centerId, locationId: "default", policy });
        const result = preview.data as { futureReservations: number; changedFields: string[] };
        setPreviewSignature(signature);
        setMessage(
          `Vista previa: ${result.futureReservations} reservas futuras permanecen sin cambios. Campos a modificar: ${result.changedFields.join(", ") || "ninguno"}.`
        );
        return;
      }

      const response = await httpsCallable(
        functions,
        "updateAgendaPolicy"
      )({
        centerId,
        locationId: "default",
        requestId: requestIdRef.current,
        policy,
      });
      setPolicy(normalizeAgendaPolicy(centerId, "default", response.data as Partial<AgendaPolicy>));
      setPreviewSignature("");
      requestIdRef.current = newRequestId();
      setMessage("Política guardada y auditada.");
    } catch {
      setMessage("No fue posible guardar. Revisa tu capacidad para configurar el centro.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl bg-slate-800 p-5 text-slate-300">Cargando políticas…</div>;
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
      <div className="mb-5 flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 text-emerald-400" />
        <div>
          <h3 className="text-xl font-bold text-white">Políticas de agenda</h3>
          <p className="text-sm text-slate-400">
            Los cambios no alteran reservas existentes. Las excepciones requieren capacidad y
            motivo.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-200">
          Duración base del bloque
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"
            value={policy.slotDurationMinutes}
            onChange={(event) => update("slotDurationMinutes", Number(event.target.value))}
          >
            {[10, 15, 20, 30, 45, 60].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-200">
          Ventana de cancelación pública
          <input
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"
            type="number"
            min={0}
            max={720}
            value={policy.cancellationWindowHours}
            onChange={(event) => update("cancellationWindowHours", Number(event.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={policy.requirePatientContact}
            onChange={(event) => update("requirePatientContact", event.target.checked)}
          />
          Exigir teléfono o correo al reservar
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={policy.allowPublicCancellation}
            onChange={(event) => update("allowPublicCancellation", event.target.checked)}
          />
          Permitir cancelación pública
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={policy.allowInternalOutsideHours}
            onChange={(event) => update("allowInternalOutsideHours", event.target.checked)}
          />
          Permitir reservas internas fuera de horario
        </label>
        <label className="text-sm text-slate-200">
          Conflictos de agenda
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"
            value={policy.appointmentConflictMode}
            onChange={(event) =>
              update(
                "appointmentConflictMode",
                event.target.value as AgendaPolicy["appointmentConflictMode"]
              )
            }
          >
            <option value="block">Bloquear</option>
            <option value="require_override">Solo excepción autorizada</option>
          </select>
        </label>
        <label className="text-sm text-slate-200">
          Conflictos de recursos
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"
            value={policy.resourceConflictMode}
            onChange={(event) =>
              update(
                "resourceConflictMode",
                event.target.value as AgendaPolicy["resourceConflictMode"]
              )
            }
          >
            <option value="block">Bloquear</option>
            <option value="require_override">Solo excepción autorizada</option>
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white disabled:opacity-50"
        >
          {saving
            ? "Guardando…"
            : previewSignature === JSON.stringify(policy)
              ? "Confirmar y guardar"
              : "Revisar impacto"}
        </button>
        {message && <p className="text-sm text-slate-300">{message}</p>}
      </div>
    </section>
  );
}
