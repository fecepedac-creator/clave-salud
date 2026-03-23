import React from "react";
import { CreditCard, DollarSign } from "lucide-react";
import { MedicalCenter } from "../../../types";

export type BillingStatus = "paid" | "due" | "overdue" | "grace" | "suspended";
export type PlanKey = "trial" | "basic" | "pro" | "enterprise";

interface SuperAdminFinanceProps {
  centers: MedicalCenter[];
  financeCenterId: string;
  setFinanceCenterId: (id: string) => void;
  financeCenter: any; // CenterExt
  renderBadge: (status?: BillingStatus) => React.ReactNode;
  updateBilling: (centerId: string, updates: Partial<any>) => void;
  todayISO: () => string;
  billingEventsLoading: boolean;
  billingEvents: any[];
}

export const SuperAdminFinance: React.FC<SuperAdminFinanceProps> = ({
  centers,
  financeCenterId,
  setFinanceCenterId,
  financeCenter,
  renderBadge,
  updateBilling,
  todayISO,
  billingEventsLoading,
  billingEvents,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Finanzas</h1>
        <p className="text-slate-500">Plan, estado de pago, vencimientos y notas internas.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <label className="block flex-1">
            <span className="text-xs font-bold text-slate-400 uppercase">Centro</span>
            <select
              className="w-full p-3 border rounded-xl bg-white"
              value={financeCenterId}
              onChange={(e) => setFinanceCenterId(e.target.value)}
            >
              <option value="">-- Seleccionar centro --</option>
              {centers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {financeCenter && (
            <div className="flex items-center gap-2">
              {financeCenter?.billing
                ? renderBadge(financeCenter.billing.billingStatus)
                : renderBadge("due")}
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                {String(financeCenter?.billing?.plan || "trial").toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {!financeCenter ? (
          <div className="text-slate-500 mt-4">No hay centro seleccionado.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Plan</span>
                <select
                  className="w-full p-3 border rounded-xl bg-white"
                  value={(financeCenter.billing?.plan || "trial") as PlanKey}
                  onChange={(e) => updateBilling(financeCenter.id, { plan: e.target.value as PlanKey })}
                >
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">UF / mes</span>
                <input
                  type="number"
                  className="w-full p-3 border rounded-xl"
                  value={Number(financeCenter.billing?.monthlyUF || 0)}
                  onChange={(e) => updateBilling(financeCenter.id, { monthlyUF: Number(e.target.value) })}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Estado de pago</span>
                <select
                  className="w-full p-3 border rounded-xl bg-white"
                  value={(financeCenter.billing?.billingStatus || "due") as BillingStatus}
                  onChange={(e) =>
                    updateBilling(financeCenter.id, {
                      billingStatus: e.target.value as BillingStatus,
                    })
                  }
                >
                  <option value="paid">Al día</option>
                  <option value="due">Por vencer</option>
                  <option value="grace">Gracia</option>
                  <option value="overdue">Atrasado</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 inline-flex items-center gap-2"
                  onClick={() =>
                    updateBilling(financeCenter.id, {
                      billingStatus: "paid",
                      lastPaidAt: todayISO(),
                    })
                  }
                  title="Marcar pagado hoy"
                >
                  <DollarSign className="w-4 h-4" /> Marcar pagado
                </button>

                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 inline-flex items-center gap-2"
                  onClick={() => updateBilling(financeCenter.id, { billingStatus: "overdue" })}
                  title="Marcar atrasado"
                >
                  <CreditCard className="w-4 h-4" /> Marcar atrasado
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Próximo vencimiento
                </span>
                <input
                  type="date"
                  className="w-full p-3 border rounded-xl"
                  value={String(financeCenter.billing?.nextDueDate || "")}
                  onChange={(e) => updateBilling(financeCenter.id, { nextDueDate: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Último pago</span>
                <input
                  type="date"
                  className="w-full p-3 border rounded-xl"
                  value={String(financeCenter.billing?.lastPaidAt || "")}
                  onChange={(e) => updateBilling(financeCenter.id, { lastPaidAt: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Notas internas</span>
                <textarea
                  className="w-full p-3 border rounded-xl min-h-[120px]"
                  value={String(financeCenter.billing?.notes || "")}
                  onChange={(e) => updateBilling(financeCenter.id, { notes: e.target.value })}
                  placeholder="Ej: convenio, prórroga, contacto administrativo..."
                />
              </label>

              <div className="p-4 bg-slate-50 rounded-2xl border">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Historial de facturación
                </div>
                {billingEventsLoading ? (
                  <div className="text-sm text-slate-500">Cargando eventos...</div>
                ) : billingEvents.length === 0 ? (
                  <div className="text-sm text-slate-500">No hay eventos registrados aún.</div>
                ) : (
                  <div className="space-y-2">
                    {billingEvents.map((evt: any) => (
                      <div key={evt.id} className="bg-white border rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-bold text-slate-800">
                            {evt.action || "Actualización"}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {evt.createdAt?.toDate ? evt.createdAt.toDate().toLocaleString() : "—"}
                          </span>
                        </div>
                        {evt.reason && (
                          <div className="text-xs text-slate-500 mt-1">Motivo: {evt.reason}</div>
                        )}
                        {evt.changes && (
                          <div className="text-xs text-slate-500 mt-2">
                            {Object.entries(evt.changes).map(([key, value]) => (
                              <div key={key}>
                                {key}: {String(value)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
