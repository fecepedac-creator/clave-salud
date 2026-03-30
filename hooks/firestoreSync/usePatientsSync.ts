import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import {
  collection,
  DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { Patient } from "../../types";

type UsePatientsSyncParams = {
  activeCenterId: string;
  authUser: User | null;
  demoMode: boolean;
  portfolioMode: "global" | "center";
  isAdmin: boolean;
};

export function usePatientsSync({
  activeCenterId,
  authUser,
  demoMode,
  portfolioMode,
  isAdmin,
}: UsePatientsSyncParams) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientsError, setPatientsError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (demoMode) return;
    const currentUid = authUser?.uid;
    if (!currentUid) {
      setPatients([]);
      setIsLoadingPatients(false);
      setPatientsError("");
      return;
    }

    if (!activeCenterId && portfolioMode === "center") {
      setPatients([]);
      setIsLoadingPatients(false);
      setPatientsError("");
      return;
    }

    setIsLoadingPatients(true);
    setPatientsError("");

    let patientsQuery;
    if (isAdmin && activeCenterId && portfolioMode === "center") {
      patientsQuery = query(
        collection(db, "patients"),
        where("accessControl.centerIds", "array-contains", activeCenterId),
        orderBy("lastUpdated", "desc"),
        limit(400)
      );
    } else if (portfolioMode === "global") {
      patientsQuery = query(
        collection(db, "patients"),
        where("accessControl.allowedUids", "array-contains", currentUid),
        orderBy("lastUpdated", "desc"),
        limit(400)
      );
    } else {
      patientsQuery = query(
        collection(db, "patients"),
        where("accessControl.allowedUids", "array-contains", currentUid),
        where("accessControl.centerIds", "array-contains", activeCenterId),
        orderBy("lastUpdated", "desc"),
        limit(400)
      );
    }

    const unsub = onSnapshot(
      patientsQuery,
      (snap: QuerySnapshot<DocumentData>) => {
        const pts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[];
        setPatients(pts);
        setIsLoadingPatients(false);
        setPatientsError("");
      },
      (error) => {
        console.error("[usePatientsSync] patients error:", error);
        setPatients([]);
        setIsLoadingPatients(false);
        setPatientsError("No pudimos sincronizar pacientes en este momento.");
      }
    );

    return () => unsub();
  }, [demoMode, authUser?.uid, activeCenterId, portfolioMode, isAdmin, reloadToken]);

  return {
    patients,
    setPatients,
    isLoadingPatients,
    patientsError,
    reloadPatients: () => setReloadToken((prev) => prev + 1),
  };
}
