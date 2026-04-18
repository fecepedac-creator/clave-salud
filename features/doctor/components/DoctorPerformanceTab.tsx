import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Appointment, MonthlyProfessionalStats } from "../../../types";
import {
  Activity,
  CheckCircle,
  DollarSign,
  Download,
  TrendingUp,
  XCircle,
} from "lucide-react";

interface DoctorPerformanceTabProps {
  centerId: string;
  doctorId: string;
}

type AppointmentWithLegacyProfessional = Appointment & {
  professionalId?: string;
};

const PROFESSIONAL_KEYS = ["doctorId", "doctorUid", "professionalId"] as const;

const sortAppointments = (items: Appointment[]) =>
  [...items].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.time.localeCompare(a.time);
  });

const appointmentMatchesProfessional = (
  appointment: AppointmentWithLegacyProfessional,
  professionalId: string
) => {
  const candidateIds = new Set(
    [appointment.doctorId, appointment.doctorUid, appointment.professionalId]
      .filter(Boolean)
      .map((value) => String(value))
  );
  return candidateIds.has(professionalId);
};

const buildMonthlyStats = (
  items: Appointment[],
  centerId: string,
  doctorId: string,
  yearMonth: string
): MonthlyProfessionalStats => {
  const totalAppointments = items.length;
  const completed = items.filter((appointment) => appointment.attendanceStatus === "completed").length;
  const noShow = items.filter((appointment) => appointment.attendanceStatus === "no-show").length;
  const cancelled = items.filter((appointment) => appointment.attendanceStatus === "cancelled").length;
  const billableAppointments = items.filter((appointment) => appointment.billable);
  const billableCount = billableAppointments.length;
  const totalAmountBillable = billableAppointments.reduce(
    (total, appointment) => total + Number(appointment.amount || 0),
    0
  );

  return {
    id: `${doctorId}_${yearMonth}`,
    centerId,
    doctorId,
    yearMonth,
    totalAppointments,
    completed,
    noShow,
    cancelled,
    billableCount,
    totalAmountBillable,
    lastUpdated: new Date().toISOString(),
  };
};

export const DoctorPerformanceTab: React.FC<DoctorPerformanceTabProps> = ({
  centerId,
  doctorId,
}) => {
  const [yearMonth, setYearMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  useEffect(() => {
    if (!centerId || !doctorId || !yearMonth) return;
    setLoadingAppointments(true);

    const [year, month] = yearMonth.split("-");
    const startDateStr = `${yearMonth}-01`;
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    const endDateStr = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
    const apptsRef = collection(db, "centers", centerId, "appointments");
    const snapshotCache = new Map<string, Appointment[]>();
    const initialized = new Set<string>();

    const mergeSnapshots = () => {
      const merged = new Map<string, Appointment>();
      snapshotCache.forEach((list) => {
        list.forEach((appointment) => {
          if (!appointmentMatchesProfessional(appointment as AppointmentWithLegacyProfessional, doctorId)) {
            return;
          }
          merged.set(appointment.id, appointment);
        });
      });
      setAppointments(sortAppointments([...merged.values()]));
    };

    const unsubscribeList = PROFESSIONAL_KEYS.map((field) => {
      const q = query(
        apptsRef,
        where(field, "==", doctorId),
        where("date", ">=", startDateStr),
        where("date", "<=", endDateStr),
        orderBy("date", "desc"),
        orderBy("time", "desc")
      );

      return onSnapshot(
        q,
        (snap) => {
          const list: Appointment[] = [];
          snap.forEach((item) => {
            const data = item.data() as Appointment;
            list.push({ ...data, id: item.id });
          });
          snapshotCache.set(field, list);
          initialized.add(field);
          mergeSnapshots();
          if (initialized.size === PROFESSIONAL_KEYS.length) {
            setLoadingAppointments(false);
          }
        },
        (error) => {
          console.error(`Error loading professional performance for ${field}:`, error);
          initialized.add(field);
          snapshotCache.set(field, []);
          mergeSnapshots();
          if (initialized.size === PROFESSIONAL_KEYS.length) {
            setLoadingAppointments(false);
          }
        }
      );
    });

    return () => {
      unsubscribeList.forEach((unsubscribe) => unsubscribe());
    };
  }, [centerId, doctorId, yearMonth]);

  const stats = useMemo(
    () => buildMonthlyStats(appointments, centerId, doctorId, yearMonth),
    [appointments, centerId, doctorId, yearMonth]
  );

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

    const rows = appointments.map((appointment) => [
      appointment.date,
      appointment.time,
      appointment.patientName,
      appointment.patientRut,
      appointment.serviceName || "Consulta médica",
      appointment.status,
      appointment.attendanceStatus || "Pendiente",
      appointment.billable ? "Sí" : "No",
      appointment.amount ? appointment.amount.toString() : "0",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((row) => row.join(",")).join("\n");

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
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            Rendimiento
          </div>
          <h2 className="mt-3 flex items-center gap-2 text-2xl font-black text-slate-900">
            <TrendingUp className="h-6 w-6 text-indigo-500" /> Mi rendimiento
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Consulta tus estadísticas mensuales con datos unificados del profesional y exporta
            el detalle de atenciones.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1">
          <label className="px-3 text-sm font-bold text-slate-600">Mes a consultar</label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="rounded-lg border-0 bg-white p-2 font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loadingAppointments ? (
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-5">
              <Activity className="h-24 w-24" />
            </div>
            <h4 className="z-10 mb-1 text-sm font-bold text-slate-500">Total citados</h4>
            <p className="z-10 text-4xl font-extrabold text-slate-800">
              {stats.totalAppointments}
            </p>
          </div>

          <div
            data-testid="doctor-kpi-completed"
            className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm"
          >
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <CheckCircle className="h-24 w-24 text-emerald-500" />
            </div>
            <h4 className="z-10 mb-1 text-sm font-bold text-emerald-700">Atendidos</h4>
            <p className="z-10 text-4xl font-extrabold text-emerald-700">{stats.completed}</p>
          </div>

          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <XCircle className="h-24 w-24 text-rose-500" />
            </div>
            <h4 className="z-10 mb-1 text-sm font-bold text-rose-700">Anuladas / no-show</h4>
            <p className="z-10 text-4xl font-extrabold text-rose-700">
              {stats.cancelled + stats.noShow}
            </p>
          </div>

          <div
            data-testid="doctor-kpi-revenue"
            className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm"
          >
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <DollarSign className="h-24 w-24 text-indigo-500" />
            </div>
            <h4 className="z-10 mb-1 text-sm font-bold text-indigo-700">Monto facturable est.</h4>
            <p className="z-10 text-4xl font-extrabold text-indigo-700">
              ${stats.totalAmountBillable.toLocaleString("es-CL")}
            </p>
            <span className="z-10 mt-1 text-xs font-medium text-indigo-500/80">
              ({stats.billableCount} atenciones)
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6">
          <h3 className="text-lg font-bold text-slate-800">Detalle mensual</h3>
          <button
            onClick={exportCSV}
            disabled={appointments.length === 0}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-sm text-slate-500">
                <th className="p-4 font-bold">Fecha / Hora</th>
                <th className="p-4 font-bold">Paciente</th>
                <th className="p-4 font-bold">Concepto</th>
                <th className="p-4 font-bold">Estado agenda</th>
                <th className="p-4 font-bold">Asistencia</th>
                <th className="p-4 text-right font-bold">Monto</th>
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
                  <td colSpan={6} className="bg-slate-50/50 p-8 text-center text-slate-500">
                    No hay citas agendadas para este mes.
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                  >
                    <td className="p-4">
                      <div className="whitespace-nowrap font-medium text-slate-800">
                        {appointment.date}
                      </div>
                      <div className="text-xs text-slate-500">{appointment.time}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{appointment.patientName}</div>
                      <div className="text-xs text-slate-500">{appointment.patientRut}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {appointment.serviceName || "Consulta médica"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          appointment.status === "booked"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {appointment.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {appointment.attendanceStatus === "completed" ? (
                        <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                          <CheckCircle className="h-4 w-4" /> Atendido
                        </span>
                      ) : appointment.attendanceStatus === "no-show" ? (
                        <span className="flex items-center gap-1 text-sm font-bold text-rose-600">
                          <XCircle className="h-4 w-4" /> No asistió
                        </span>
                      ) : appointment.attendanceStatus === "cancelled" ? (
                        <span className="flex items-center gap-1 text-sm font-bold text-slate-400">
                          Anulado
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">- Pendiente -</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div
                        className={`font-bold ${
                          appointment.billable ? "text-indigo-600" : "text-slate-400"
                        }`}
                      >
                        {appointment.amount ? `$${appointment.amount.toLocaleString("es-CL")}` : "$0"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {appointment.billable ? "Facturable" : "No facturable"}
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
