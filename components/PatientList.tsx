import React, { useEffect, useMemo, useState, useContext } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Search, Plus, User } from "lucide-react";
import { Patient } from "../types";
import { db } from "../firebase";
import { CenterContext } from "../CenterContext";

type Props = {
  /** Si lo pasas, se usa en vez de leer desde Firestore */
  patients?: Patient[];
  onSelect?: (patient: Patient) => void;
  onCreateNew?: () => void;
  className?: string;
};

const PatientList: React.FC<Props> = ({ patients, onSelect, onCreateNew, className }) => {
  const { activeCenterId } = useContext(CenterContext);
  const hasActiveCenter = Boolean(activeCenterId);
  const [remotePatients, setRemotePatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");

  // Leer desde Firestore solo si no llegan patients por props
  useEffect(() => {
    if (patients) return;
    if (!activeCenterId) {
      setRemotePatients([]);
      return;
    }

    const baseRef = collection(db, "centers", activeCenterId, "patients");
    const q = query(baseRef, orderBy("fullName", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Patient[] = [];
        snap.forEach((d) => rows.push(d.data() as Patient));
        setRemotePatients(rows);
      },
      () => {
        // Si falla orderBy por índice, igual mostramos sin crashear:
        const q2 = query(baseRef);
        const unsub2 = onSnapshot(q2, (snap2) => {
          const rows2: Patient[] = [];
          snap2.forEach((d) => rows2.push(d.data() as Patient));
          setRemotePatients(rows2);
        });
        return () => unsub2();
      }
    );

    return () => unsub();
  }, [activeCenterId, patients]);

  const data = patients ?? remotePatients;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((p) => {
      const name = (p.fullName ?? "").toLowerCase();
      const rut = (p.rut ?? "").toLowerCase();
      return name.includes(s) || rut.includes(s);
    });
  }, [data, search]);

  return (
    <div className={className ?? ""}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-slate-500" />
          <h3 className="text-xl font-bold text-slate-800">Pacientes</h3>
          {activeCenterId && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              Centro: {activeCenterId}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o RUT…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={onCreateNew}
            disabled={!hasActiveCenter}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={hasActiveCenter ? "Crear paciente" : "Selecciona un centro para crear pacientes"}
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6 text-slate-500">
            {activeCenterId
              ? "No hay pacientes registrados en este centro."
              : "Selecciona un centro para ver pacientes."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(p)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center md:justify-between gap-1"
                >
                  <div>
                    <div className="font-bold text-slate-800">{p.fullName || "Sin nombre"}</div>
                    <div className="text-sm text-slate-500">{p.rut || "Sin RUT"}</div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {p.commune ? `Comuna: ${p.commune}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Los datos se leen desde Firebase (Firestore) en tiempo real para el centro activo.
      </div>
    </div>
  );
};

export default PatientList;
