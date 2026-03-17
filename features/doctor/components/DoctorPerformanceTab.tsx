import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { Appointment, MonthlyProfessionalStats } from "../../../types";
import {
  Activity,
  Download,
  FileText,
  Search,
  TrendingUp,
  DollarSign,
  XCircle,
  CheckCircle,
} from "lucide-react";

interface DoctorPerformanceTabProps {
  centerId: string;
  doctorId: string; // The professional's ID
}

export const DoctorPerformanceTab: React.FC<DoctorPerformanceTabProps> = ({
  centerId,
  doctorId,
}) => {
  // Current month in YYYY-MM format by default
  const [yearMonth, setYearMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [stats, setStats] = useState<MonthlyProfessionalStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Load Aggregated Stats
  useEffect(() => {
    if (!centerId || !doctorId || !yearMonth) return;
    setLoadingStats(true);

    const profKey = `${doctorId}_${yearMonth}`;
    const statsRef = doc(db, "centers", centerId, "stats_professional_month", profKey);

    const unsubscribe = onSnapshot(
      statsRef,
      (snap) => {
        if (snap.exists()) {
          setStats(snap.data() as MonthlyProfessionalStats);
        } else {
          setStats(null); // No data yet for this month
        }
        setLoadingStats(false);
      },
      (error) => {
        console.error("Error loading professional stats:", error);
        setLoadingStats(false);
      }
    );

    return () => unsubscribe();
  }, [centerId, doctorId, yearMonth]);

  // Load Detailed Appointments for the selected month
  useEffect(() => {
    if (!centerId || !doctorId || !yearMonth) return;
    setLoadingAppointments(true);

    // Calculate start and end strings for the month based on YYYY-MM
    const [year, month] = yearMonth.split("-");
    const startDateStr = `${yearMonth}-01`;
    // Quick way to get last day of month in JS
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDateStr = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

    const apptsRef = collection(db, "centers", centerId, "appointments");

    // As DoctorID fields have varied over time (doctorId, doctorUid, professionalId)
    // the easiest safe query across all is equality on doctorId (or depending on how it's saved)
    // Usually it's doctorId.
    const q = query(
      apptsRef,
      where("doctorId", "==", doctorId),
      where("date", ">=", startDateStr),
      where("date", "<=", endDateStr),
      orderBy("date", "desc"),
      orderBy("time", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Appointment[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as Appointment;
          // Double check it's not a soft deleted one entirely excluded from views if you want
          list.push({ ...data, id: doc.id });
        });
        setAppointments(list);
        setLoadingAppointments(false);
      },
      (error) => {
        console.error("Error loading detailed appointments:", error);
        setLoadingAppointments(false);
      }
    );

    return () => unsubscribe();
  }, [centerId, doctorId, yearMonth]);

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Fecha",
      "Hora",
      "Paciente",
      "RUT",
      "Servicio/Tipo",
      "Estado Agendamiento",
      "Asistencia",
      "Cobrado",
      "Monto",
    ];
    const rows = appointments.map((a) => {
      return [
        a.date,
        a.time,
        a.patientName,
        a.patientRut,
        a.serviceName || "Consulta",
        a.status,
        a.attendanceStatus || "Pendiente",
        a.billable ? "Sí" : "No",
        a.amount ? a.amount.toString() : "0",
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rendimiento_${doctorId}_${yearMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-500" /> Mi Rendimiento
          </h2>
          <p className="text-slate-500">
            Consulta tus estadísticas mensuales y exporta el detalle de atenciones.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl items-center gap-2">
          <label className="text-sm font-bold text-slate-600 px-3">Mes a consultar:</label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="bg-white border-0 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {loadingStats ? (
        <div className="h-32 bg-slate-100 animate-pulse rounded-2xl"></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Activity className="w-24 h-24" />
            </div>
            <h4 className="text-slate-500 font-bold text-sm mb-1 z-10">Total Citados</h4>
            <p className="text-4xl font-extrabold text-slate-800 z-10">
              {stats?.totalAppointments || 0}
            </p>
          </div>

          <div
            data-testid="doctor-kpi-completed"
            className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CheckCircle className="w-24 h-24 text-emerald-500" />
            </div>
            <h4 className="text-emerald-700 font-bold text-sm mb-1 z-10">Atendidos (Completado)</h4>
            <p className="text-4xl font-extrabold text-emerald-700 z-10">{stats?.completed || 0}</p>
          </div>

          <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <XCircle className="w-24 h-24 text-rose-500" />
            </div>
            <h4 className="text-rose-700 font-bold text-sm mb-1 z-10">Anuladas / No-Show</h4>
            <p className="text-4xl font-extrabold text-rose-700 z-10">
              {(stats?.cancelled || 0) + (stats?.noShow || 0)}
            </p>
          </div>

          <div
            data-testid="doctor-kpi-revenue"
            className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 shadow-sm flex flex-col justify-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign className="w-24 h-24 text-indigo-500" />
            </div>
            <h4 className="text-indigo-700 font-bold text-sm mb-1 z-10">Monto Facturable Est.</h4>
            <p className="text-4xl font-extrabold text-indigo-700 z-10">
              ${(stats?.totalAmountBillable || 0).toLocaleString("es-CL")}
            </p>
            <span className="text-xs text-indigo-500/80 font-medium z-10 mt-1">
              ({stats?.billableCount || 0} atenciones)
            </span>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">Detalle Mensual</h3>
          <button
            onClick={exportCSV}
            disabled={appointments.length === 0}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4 font-bold">Fecha / Hora</th>
                <th className="p-4 font-bold">Paciente</th>
                <th className="p-4 font-bold">Concepto</th>
                <th className="p-4 font-bold">Estado Agenda</th>
                <th className="p-4 font-bold">Asistencia</th>
                <th className="p-4 font-bold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {loadingAppointments ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <div className="animate-pulse">Cargando detalle de citas...</div>
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 bg-slate-50/50">
                    No hay citas agendadas para este mes.
                  </td>
                </tr>
              ) : (
                appointments.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-800 whitespace-nowrap">{a.date}</div>
                      <div className="text-xs text-slate-500">{a.time}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{a.patientName}</div>
                      <div className="text-xs text-slate-500">{a.patientRut}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {a.serviceName || "Consulta Médica"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          a.status === "booked"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {a.attendanceStatus === "completed" ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                          <CheckCircle className="w-4 h-4" /> Atendido
                        </span>
                      ) : a.attendanceStatus === "no-show" ? (
                        <span className="flex items-center gap-1 text-rose-600 text-sm font-bold">
                          <XCircle className="w-4 h-4" /> No Asistió
                        </span>
                      ) : a.attendanceStatus === "cancelled" ? (
                        <span className="flex items-center gap-1 text-slate-400 text-sm font-bold">
                          Anulado
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">- Pendiente -</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div
                        className={`font-bold ${a.billable ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        {a.amount ? `$${a.amount.toLocaleString("es-CL")}` : "$0"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {a.billable ? "Facturable" : "No Facturable"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
