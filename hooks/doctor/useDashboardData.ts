import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { WhatsappTemplate, ExamOrderCatalog } from "../../types";
import { DEFAULT_EXAM_ORDER_CATALOG } from "../../constants";

interface UseDashboardDataProps {
    activeCenterId: string | null;
}

export const useDashboardData = ({ activeCenterId }: UseDashboardDataProps) => {
    const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsappTemplate[]>([]);
    const [whatsappTemplatesError, setWhatsappTemplatesError] = useState<string | null>(null);
    const [examOrderCatalog, setExamOrderCatalog] = useState<ExamOrderCatalog>(DEFAULT_EXAM_ORDER_CATALOG);

    // 1. WhatsApp Templates Sync
    useEffect(() => {
        if (!db || !activeCenterId) {
            setWhatsappTemplates([]);
            setWhatsappTemplatesError(null);
            return;
        }

        const docRef = doc(db, "centers", activeCenterId, "settings", "whatsapp");
        const unsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                const data = snapshot.data();
                setWhatsappTemplates(
                    Array.isArray(data?.templates) ? (data?.templates as WhatsappTemplate[]) : []
                );
                setWhatsappTemplatesError(null);
            },
            (error) => {
                const message =
                    error.code === "permission-denied"
                        ? "Sin permisos para leer plantillas de WhatsApp."
                        : "Error cargando plantillas de WhatsApp.";
                setWhatsappTemplatesError(message);
            }
        );

        return () => unsubscribe();
    }, [activeCenterId]);

    // 2. Exam Order Catalog Loading
    useEffect(() => {
        const loadExamOrderCatalog = async () => {
            try {
                const centerCatalogRef = activeCenterId
                    ? doc(db, "centers", activeCenterId, "settings", "examOrderCatalog")
                    : null;
                const globalCatalogRef = doc(db, "globalSettings", "examOrderCatalog");

                if (centerCatalogRef) {
                    const centerSnap = await getDoc(centerCatalogRef);
                    if (centerSnap.exists()) {
                        const data = centerSnap.data() as any;
                        if (Array.isArray(data?.categories)) {
                            setExamOrderCatalog({
                                version: Number(data.version || 1),
                                categories: data.categories,
                            });
                            return;
                        }
                    }
                }

                const globalSnap = await getDoc(globalCatalogRef);
                if (globalSnap.exists()) {
                    const data = globalSnap.data() as any;
                    if (Array.isArray(data?.categories)) {
                        setExamOrderCatalog({
                            version: Number(data.version || 1),
                            categories: data.categories,
                        });
                        return;
                    }
                }

                setExamOrderCatalog(DEFAULT_EXAM_ORDER_CATALOG);
            } catch (error) {
                console.error("loadExamOrderCatalog", error);
                setExamOrderCatalog(DEFAULT_EXAM_ORDER_CATALOG);
            }
        };

        loadExamOrderCatalog();
    }, [activeCenterId]);

    return {
        whatsappTemplates,
        whatsappTemplatesError,
        examOrderCatalog,
    };
};
