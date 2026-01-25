import { useState, useEffect, useCallback, useMemo } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { MedicalCenter } from "../types";
import { INITIAL_CENTERS } from "../constants";
import { CenterModules } from "../CenterContext";

function isValidCenter(c: any): c is MedicalCenter {
  return (
    !!c &&
    typeof c === "object" &&
    typeof (c as any).id === "string" &&
    (c as any).id.length > 0 &&
    typeof (c as any).name === "string"
  );
}

export function useCenters(demoMode: boolean, isSuperAdminClaim: boolean) {
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [activeCenterId, setActiveCenterId] = useState<string>("");

  const activeCenter = useMemo(
    () => centers.find((c) => c.id === activeCenterId) ?? null,
    [centers, activeCenterId]
  );

  const updateModules = useCallback(
    (modules: CenterModules) => {
      if (!activeCenterId) return;
      setCenters((prev) =>
        prev.map((center) =>
          center.id === activeCenterId
            ? { ...center, modules: { ...(center.modules ?? {}), ...modules } }
            : center
        )
      );
    },
    [activeCenterId]
  );

  // Load centers from Firestore (respecting user permissions)
  useEffect(() => {
    if (demoMode) {
      setCenters(INITIAL_CENTERS);
      return;
    }
    let unsubscribers: Array<() => void> = [];
    let cancelled = false;

    const run = async () => {
      try {
        if (!auth.currentUser) {
          const unsub = onSnapshot(
            query(collection(db, "centers"), where("isActive", "==", true)),
            (snap) => {
              if (cancelled) return;
              const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicalCenter[];
              setCenters(items);
            },
            () => {
              if (cancelled) return;
              setCenters([]);
            }
          );
          unsubscribers.push(unsub);
          return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const userSnap = await getDoc(doc(db, "users", uid));
        const profile: any = userSnap.exists() ? userSnap.data() : null;

        const rolesRaw: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
        const roles = rolesRaw
          .map((r: any) => String(r ?? "").trim().toLowerCase())
          .filter(Boolean);

        const centersRaw: any[] = Array.isArray(profile?.centros)
          ? profile.centros
          : Array.isArray(profile?.centers)
          ? profile.centers
          : [];
        const allowed = centersRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean);

        const isSuper =
          isSuperAdminClaim ||
          roles.includes("super_admin") ||
          roles.includes("superadmin");

        if (isSuper) {
          const unsub = onSnapshot(
            query(collection(db, "centers")),
            (snap) => {
              if (cancelled) return;
              const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MedicalCenter[];
              setCenters(items);
            },
            () => {
              if (cancelled) return;
              setCenters([]);
            }
          );
          unsubscribers.push(unsub);
          return;
        }

        if (!allowed.length) {
          setCenters([]);
          return;
        }

        // "in" maximum 10
        const chunks: string[][] = [];
        for (let i = 0; i < allowed.length; i += 10) chunks.push(allowed.slice(i, i + 10));

        const all: Record<string, MedicalCenter> = {};
        for (const ids of chunks) {
          const unsub = onSnapshot(
            query(collection(db, "centers"), where(documentId(), "in", ids)),
            (snap) => {
              if (cancelled) return;
              snap.docs.forEach((d) => {
                all[d.id] = ({ id: d.id, ...(d.data() as any) } as any);
              });
              const merged = Object.values(all);
              setCenters(merged);
            },
            () => {
              if (cancelled) return;
              setCenters([]);
            }
          );
          unsubscribers.push(unsub);
        }
      } catch {
        if (!cancelled) setCenters([]);
      }
    };

    run();

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch (e) {
          // Ignore cleanup errors during unmount
        }
      });
    };
  }, [demoMode, isSuperAdminClaim]);

  return {
    centers,
    setCenters,
    activeCenterId,
    setActiveCenterId,
    activeCenter,
    updateModules,
  };
}
