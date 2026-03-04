import React, { useState, useEffect } from "react";
import { db, functions } from "../../../firebase";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { MonthlyCenterStats, MonthlyProfessionalStats, MonthClosure, Doctor } from "../../../types";
import { TrendingUp, DollarSign, XCircle, CheckCircle, Lock, Download, Activity, UsersRound, Unlock } from "lucide-react";

interface AdminPerformanceTabProps {
    centerId: string;
    currentUserUid: string;
    doctors: Doctor[];
    showToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
}

export const AdminPerformanceTab: React.FC<AdminPerformanceTabProps> = ({
    centerId,
    currentUserUid,
    doctors,
    showToast,
}) => {
    const [yearMonth, setYearMonth] = useState<string>(() => {
        const isTest = new URLSearchParams(window.location.search).has("agent_test");
        if (isTest) return "2026-03";
        return new Date().toISOString().slice(0, 7);
    });

    const [centerStats, setCenterStats] = useState<MonthlyCenterStats | null>(null);
    const [profStats, setProfStats] = useState<MonthlyProfessionalStats[]>([]);
    const [monthClosure, setMonthClosure] = useState<MonthClosure | null>(null);

    const [loadingStats, setLoadingStats] = useState(true);
    const [isClosingMonth, setIsClosingMonth] = useState(false);
    const [isReopeningMonth, setIsReopeningMonth] = useState(false);

    // Load Center Stats & Closure Status
    useEffect(() => {
        if (!centerId || !yearMonth) return;
        setLoadingStats(true);

        const centerStatsRef = doc(db, "centers", centerId, "stats_center_month", yearMonth);
        const closureRef = doc(db, "centers", centerId, "closures_month", yearMonth);

        const unsubStats = onSnapshot(centerStatsRef, (snap) => {
            setCenterStats(snap.exists() ? (snap.data() as MonthlyCenterStats) : null);
            setLoadingStats(false);
        }, (error) => {
            console.error("Firestore Error (unsubStats):", error);
            setLoadingStats(false);
        });

        const unsubClosure = onSnapshot(closureRef, (snap) => {
            setMonthClosure(snap.exists() ? (snap.data() as MonthClosure) : null);
        }, (error) => console.error("Firestore Error (unsubClosure):", error));

        // Load professional breakdown
        const profStatsRef = collection(db, "centers", centerId, "stats_professional_month");
        const q = query(
            profStatsRef,
            where("yearMonth", "==", yearMonth)
        );

        const unsubProf = onSnapshot(q, (snap) => {
            const list: MonthlyProfessionalStats[] = [];
            snap.forEach((d) => {
                const data = d.data() as MonthlyProfessionalStats;
                list.push({ ...data, id: d.id, doctorId: data.doctorId || d.id.split('_')[0] });
            });
            // Ordenamiento seguro (evita NaN por undefined tests)
            list.sort((a, b) => (b.totalAmountBillable ?? 0) - (a.totalAmountBillable ?? 0));
            setProfStats(list);
            setLoadingStats(false); // Refuerzo
        }, (error) => console.error("Firestore Error (unsubProf):", error));

        return () => {
            unsubStats();
            unsubClosure();
            unsubProf();
        };
    }, [centerId, yearMonth]);

    const handleCloseMonth = async () => {
        if (!window.confirm(`¿Estás seguro de cerrar el mes de ${yearMonth}? Esto bloqueará ediciones a los montos y asistencia de las recuadaciones registradas este mes.`)) return;

        setIsClosingMonth(true);
        try {
            const closeMonthFn = httpsCallable(functions, "closeMonth");
            await closeMonthFn({ centerId, yearMonth });
            showToast?.("Mes cerrado exitosamente.", "success");
        } catch (error: any) {
            console.error("Error closing month:", error);
            showToast?.(error?.message || "Error al intentar cerrar el mes.", "error");
        } finally {
            setIsClosingMonth(false);
        }
    };

    const handleReopenMonth = async () => {
        if (!window.confirm(`¿ESTÁS ABSOLUTAMENTE SEGURO de reabrir el mes de ${yearMonth}?\n\nEsto permitirá la modificación de totales contables históricos y afectará la integridad de facturaciones pasadas. Procede solo si sabes lo que haces.`)) return;

        setIsReopeningMonth(true);
        try {
            const reopenMonthFn = httpsCallable(functions, "reopenMonth");
            await reopenMonthFn({ centerId, yearMonth });
            showToast?.("Mes reabierto exitosamente.", "success");
        } catch (error: any) {
            console.error("Error reopening month:", error);
            showToast?.(error?.message || "Error al intentar reabrir el mes.", "error");
        } finally {
            setIsReopeningMonth(false);
        }
    };

    const getDoctorName = (uid: string) => {
        const found = doctors.find(d => d.id === uid || d.uid === uid);
        return found ? found.name : "Profesional Desconocido";
    };

    const exportCenterCSV = () => {
        const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replaceAll('"', '""')}"`;
        const headers = ["Profesional", "Citas Agendadas", "Atendidas", "Ausencias/Anuladas", "Atenciones Facturables", "Monto Generado"].map(esc);

        const rows = profStats.map((p) => [
            // Usar fullName del documento primero (más confiable que buscar en doctors[])
            p.fullName || getDoctorName(p.doctorId),
            p.totalAppointments || 0,
            p.completed || 0,
            (p.noShow || 0) + (p.cancelled || 0),
            p.billableCount || 0,
            p.totalAmountBillable || 0
        ].map(esc));

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(";") + "\n"
            + rows.map(e => e.join(";")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Produccion_${centerId}_${yearMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isMonthClosed = monthClosure?.status === "closed";

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-500" /> Producción Mensual
                    </h2>
                    <p className="text-slate-500">Supervisa el rendimiento del centro, genera reportes de profesionales y realiza cierres mensuales.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    {isMonthClosed ? (
                        <div data-testid="month-status-badge" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-bold border border-slate-200">
                            <Lock className="w-4 h-4" /> Mes Cerrado
                        </div>
                    ) : (
                        <div data-testid="month-status-badge" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-sm font-bold border border-emerald-200">
                            <CheckCircle className="w-4 h-4" /> Mes Abierto
                        </div>
                    )}

                    <div className="flex bg-slate-100 p-1 rounded-xl items-center gap-2">
                        <input
                            data-testid="month-selector"
                            type="month"
                            value={yearMonth}
                            onChange={(e) => setYearMonth(e.target.value)}
                            className="bg-white border-0 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Overall KPIs */}
            {loadingStats ? (
                <div data-testid="performance-loading-skeleton" className="h-32 bg-slate-100 animate-pulse rounded-2xl"></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div data-testid="kpi-total-appointments" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Activity className="w-24 h-24" />
                        </div>
                        <h4 className="text-slate-500 font-bold text-sm mb-1 z-10">Total Centro</h4>
                        <p className="text-4xl font-extrabold text-slate-800 z-10">{centerStats?.totalAppointments || 0} <span className="text-lg text-slate-500">citas</span></p>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CheckCircle className="w-24 h-24 text-emerald-500" />
                        </div>
                        <h4 className="text-emerald-700 font-bold text-sm mb-1 z-10">Atenciones Efectivas</h4>
                        <p className="text-4xl font-extrabold text-emerald-700 z-10">{centerStats?.completed || 0}</p>
                    </div>

                    <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <XCircle className="w-24 h-24 text-rose-500" />
                        </div>
                        <h4 className="text-rose-700 font-bold text-sm mb-1 z-10">Ausentismo / Anuladas</h4>
                        <p className="text-4xl font-extrabold text-rose-700 z-10">{(centerStats?.cancelled || 0) + (centerStats?.noShow || 0)}</p>
                    </div>

                    <div data-testid="kpi-total-revenue" className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 shadow-md flex flex-col justify-center relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <DollarSign className="w-24 h-24" />
                        </div>
                        <h4 className="font-bold text-indigo-100 text-sm mb-1 z-10">Ingreso Mensual (Est.)</h4>
                        <p className="text-4xl font-extrabold z-10">
                            ${(centerStats?.totalAmountBillable || 0).toLocaleString("es-CL")}
                        </p>
                    </div>
                </div>
            )}

            {/* Professionals Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg"><UsersRound className="w-5 h-5 text-indigo-600" /></div>
                        <h3 className="font-bold text-slate-800 text-lg">Productividad por Profesional</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            data-testid="btn-export-csv"
                            onClick={exportCenterCSV}
                            disabled={profStats.length === 0}
                            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
                        >
                            <Download className="w-4 h-4" /> Bajar Consolidado
                        </button>

                        {!isMonthClosed ? (
                            <button
                                data-testid="btn-close-month"
                                onClick={handleCloseMonth}
                                disabled={isClosingMonth || !centerStats}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm shadow-sm"
                            >
                                <Lock className="w-4 h-4" /> Cerrar Mes Contable
                            </button>
                        ) : (
                            <button
                                data-testid="btn-reopen-month"
                                onClick={handleReopenMonth}
                                disabled={isReopeningMonth}
                                className="flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-lg font-bold hover:bg-rose-200 border border-rose-200 transition-colors disabled:opacity-50 text-sm shadow-sm"
                            >
                                <Unlock className="w-4 h-4" /> Forzar Reapertura
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table data-testid="prof-stats-table" className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-500 text-sm border-b border-slate-100">
                                <th className="p-4 font-bold">Profesional</th>
                                <th className="p-4 font-bold text-center">Citas Totales</th>
                                <th className="p-4 font-bold text-center" title="Completadas">Efectivas</th>
                                <th className="p-4 font-bold text-center" title="No-Show o Anuladas">Ausencias</th>
                                <th className="p-4 font-bold text-center" title="Citas Facturables (Completadas)">Facturables</th>
                                <th className="p-4 font-bold text-right">Recaudación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profStats.length === 0 && !loadingStats ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        Sin datos de rendimiento para este mes.
                                    </td>
                                </tr>
                            ) : (
                                profStats.map((p) => {
                                    const profName = p.fullName || getDoctorName(p.doctorId);
                                    return (
                                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td data-testid={`prof-name-${p.doctorId}`} className="p-4 font-bold text-slate-800 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs shadow-inner">
                                                    {(profName || "PR").substring(0, 2).toUpperCase()}
                                                </div>
                                                {profName}
                                            </td>
                                            <td className="p-4 text-center text-slate-600 font-medium">
                                                {p.totalAppointments || 0}
                                            </td>
                                            <td className="p-4 text-center text-emerald-600 font-bold">
                                                {p.completed || 0}
                                            </td>
                                            <td className="p-4 text-center text-rose-500 font-medium">
                                                {(p.noShow || 0) + (p.cancelled || 0)}
                                            </td>
                                            <td className="p-4 text-center text-indigo-600 font-bold">
                                                {p.billableCount || 0}
                                            </td>
                                            <td className="p-4 text-right font-extrabold text-slate-800">
                                                ${(p.totalAmountBillable || 0).toLocaleString("es-CL")}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
