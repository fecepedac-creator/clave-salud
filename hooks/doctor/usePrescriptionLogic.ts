import { useState } from "react";
import { Prescription } from "../../types";

export const usePrescriptionLogic = () => {
    // Printing State
    const [docsToPrint, setDocsToPrint] = useState<Prescription[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isClinicalReportOpen, setIsClinicalReportOpen] = useState(false);

    const handlePrint = (docs: Prescription[]) => {
        setDocsToPrint(docs);
        setIsPrintModalOpen(true);
    };

    return {
        docsToPrint,
        setDocsToPrint,
        isPrintModalOpen,
        setIsPrintModalOpen,
        isClinicalReportOpen,
        setIsClinicalReportOpen,
        handlePrint,
    };
};
