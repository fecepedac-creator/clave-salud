import React from "react";
import { Users, RefreshCw, CreditCard, Edit } from "lucide-react";

interface SuperAdminUsersProps {
  globalUsers: any[];
  usersLoading: boolean;
  fetchGlobalUsers: () => void;
  userSearchTerm: string;
  setUserSearchTerm: (term: string) => void;
  editingUser: any | null;
  setEditingUser: (user: any | null) => void;
  handleSaveUser: (user: any) => void;
}

export const SuperAdminUsers: React.FC<SuperAdminUsersProps> = ({
  globalUsers,
  usersLoading,
  fetchGlobalUsers,
  userSearchTerm,
  setUserSearchTerm,
  editingUser,
  setEditingUser,
  handleSaveUser,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-800">Gestión de Usuarios</h1>
          <p className="text-slate-500">
            Control global de perfiles, roles y suscripciones profesionales.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              className="pl-10 pr-4 py-2 border rounded-xl text-sm w-64 bg-white"
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
            />
            <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>
          <button
            onClick={fetchGlobalUsers}
            className="p-2 bg-white border rounded-xl text-slate-600 hover:bg-slate-50"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${usersLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {editingUser ? (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">
              Editar Usuario: {editingUser.email}
            </h3>
            <button onClick={() => setEditingUser(null)} className="text-slate-400 font-bold">
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Nombre Completo</span>
                <input
                  className="w-full p-3 border rounded-xl bg-slate-50"
                  value={editingUser.fullName || ""}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Estado Cuenta</span>
                <div className="flex items-center gap-3 mt-2 px-3 py-2 bg-slate-50 rounded-xl border">
                  <input
                    type="checkbox"
                    checked={editingUser.activo !== false}
                    onChange={(e) => setEditingUser({ ...editingUser, activo: e.target.checked })}
                    className="w-5 h-5 accent-health-600"
                  />
                  <span className="font-bold text-slate-700">Usuario Activo</span>
                </div>
              </label>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" /> Suscripción Profesional
              </h4>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase">Estado de Pago</span>
                <select
                  className="w-full p-3 border rounded-xl bg-white mt-1"
                  value={editingUser.billing?.status || "trial"}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      billing: { ...(editingUser.billing || {}), status: e.target.value },
                    })
                  }
                >
                  <option value="active">Activo / Al día</option>
                  <option value="trial">Periodo de Prueba</option>
                  <option value="overdue">Pendiente de Pago</option>
                  <option value="suspended">Suspendido / Bloqueado</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase">Plan</span>
                  <select
                    className="w-full p-3 border rounded-xl bg-white mt-1"
                    value={editingUser.billing?.plan || "free"}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        billing: { ...(editingUser.billing || {}), plan: e.target.value },
                      })
                    }
                  >
                    <option value="free">Gratuito</option>
                    <option value="basic">Básico</option>
                    <option value="professional">Profesional</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase">Vencimiento</span>
                  <input
                    type="date"
                    className="w-full p-3 border rounded-xl bg-white mt-1"
                    value={editingUser.billing?.nextDueDate || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        billing: {
                          ...(editingUser.billing || {}),
                          nextDueDate: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <button
              onClick={() => setEditingUser(null)}
              className="px-6 py-2 font-bold text-slate-500"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSaveUser(editingUser)}
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Usuario / Email</th>
                <th className="px-6 py-4">Rol Principal</th>
                <th className="px-6 py-4">Suscripción</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {globalUsers
                .filter(
                  (u) =>
                    u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    u.fullName?.toLowerCase().includes(userSearchTerm.toLowerCase())
                )
                .map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{u.fullName || "Sin nombre"}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 uppercase">
                      {u.role || u.roles?.[0] || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                          {u.billing?.plan || "free"}
                        </span>
                        {u.billing?.nextDueDate && (
                          <span className="text-[10px] text-slate-400">
                            Vence: {u.billing.nextDueDate}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          u.activo === false || u.billing?.status === "suspended"
                            ? "bg-red-100 text-red-700"
                            : u.billing?.status === "overdue"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {u.activo === false ? "Inactivo" : u.billing?.status || "active"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
