import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  QueryDocumentSnapshot,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { Search, Plus, User } from "lucide-react";
import { Patient } from "../types";
import { db, auth } from "../firebase";
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
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [orderField, setOrderField] = useState<"fullName" | "lastUpdated">("fullName");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc");
  const pageSize = 25;

  // Read from root /patients collection filtered by current user
  useEffect(() => {
    if (patients) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setRemotePatients([]);
      return;
    }

    const baseRef = collection(db, "patients");
    setLastDoc(null);
    setHasMore(false);
    setOrderField("fullName");
    setOrderDirection("asc");
    const q = query(
      baseRef,
      where("accessControl.allowedUids", "array-contains", currentUid),
      orderBy("fullName", "asc"),
      limit(pageSize)
    );
    const fallbackQuery = query(
      baseRef,
      where("accessControl.allowedUids", "array-contains", currentUid),
      orderBy("lastUpdated", "desc"),
      limit(pageSize)
    );

    let fallbackUnsub: (() => void) | null = null;
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Patient[] = [];
        snap.forEach((d) => rows.push(d.data() as Patient));
        setRemotePatients(rows);
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === pageSize);
      },
      () => {
        // If index missing, fallback:
        setOrderField("lastUpdated");
        setOrderDirection("desc");
        fallbackUnsub = onSnapshot(fallbackQuery, (snap2) => {
          const rows2: Patient[] = [];
          snap2.forEach((d) => rows2.push(d.data() as Patient));
          setRemotePatients(rows2);
          setLastDoc(snap2.docs[snap2.docs.length - 1] ?? null);
          setHasMore(snap2.docs.length === pageSize);
        });
      }
    );

    return () => {
      unsub();
      fallbackUnsub?.();
    };
  }, [activeCenterId, patients]);

  const handleLoadMore = async () => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid || !lastDoc || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const baseRef = collection(db, "patients");
      const moreQuery = query(
        baseRef,
        where("accessControl.allowedUids", "array-contains", currentUid),
        orderBy(orderField, orderDirection),
        startAfter(lastDoc),
        limit(pageSize)
      );
      const snap = await getDocs(moreQuery);
      const rows = snap.docs.map((d) => d.data() as Patient);
      setRemotePatients((prev) => [...prev, ...rows]);
      setLastDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === pageSize);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const data = patients ?? remotePatients;
  const isActiveRecord = (p: Patient) => p?.active !== false && (p as any).activo !== false;
  const activeData = data.filter(isActiveRecord);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return activeData;
    return activeData.filter((p) => {
      const name = (p.fullName ?? "").toLowerCase();
      const rut = (p.rut ?? "").toLowerCase();
      return name.includes(s) || rut.includes(s);
    });
  }, [activeData, search]);

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
          <>
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
            {!patients && hasMore && (
              <div className="p-4 flex justify-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? "Cargando..." : "Ver más"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Los datos se leen desde Firebase (Firestore) en tiempo real para el centro activo.
      </div>
    </div>
  );
};

export default PatientList;
