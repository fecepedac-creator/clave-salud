import React, { useState, useContext } from "react";
import useDrivePicker from "react-google-drive-picker";
import { useCrudOperations } from "../hooks/useCrudOperations";
import { useAuth } from "../hooks/useAuth";
import { CenterContext } from "../CenterContext";
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Upload, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "./Toast";
import { Attachment, Patient, Consultation } from "../types";
import mammoth from "mammoth";
import { generateId } from "../utils";
import { extractPatientData, fileToGenerativePart } from "../services/geminiService";

interface DrivePickerProps {
  onImportSuccess?: () => void;
  clientId: string;
  apiKey: string;
  targetPatientId?: string;
  currentAttachments?: Attachment[];
}

export default function DrivePicker({
  onImportSuccess,
  clientId,
  apiKey,
  targetPatientId,
  currentAttachments = [],
}: DrivePickerProps) {
  const [openPicker, authResponse] = useDrivePicker();
  const { currentUser } = useAuth();
  const { activeCenterId } = useContext(CenterContext);
  const { showToast } = useToast();

  const { updatePatient } = useCrudOperations(activeCenterId || "", [], showToast, currentUser);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  // --- GOOGLE DRIVE PICKER ---
  const handleOpenPicker = () => {
    openPicker({
      clientId,
      developerKey: apiKey,
      viewId: "DOCS",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      setIncludeFolders: true,
      customViews: [
        {
          viewId: "DOCS",
          mimeTypes:
            "application/pdf,application/vnd.google-apps.document,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png",
        },
      ],
      callbackFunction: async (data: any) => {
        if (data.action === "picked") {
          setUploading(true);
          const docs = data.docs || [];
          setUploadStatus(`Procesando ${docs.length} de Drive...`);

          for (const doc of docs) {
            const driveUrl = doc.url || doc.webViewLink || "";
            let extractedData: Partial<Patient> | null = null;

            try {
              // --- AI EXTRACTION FROM DRIVE FILE ---
              if (authResponse?.access_token) {
                setUploadStatus(`Analizando ${doc.name} con IA...`);

                // 1. Download File from Google Drive
                const fileResponse = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                  {
                    headers: {
                      Authorization: `Bearer ${authResponse.access_token}`,
                    },
                  }
                );

                if (fileResponse.ok) {
                  const arrayBuffer = await fileResponse.arrayBuffer();
                  if (
                    doc.mimeType ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  ) {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    extractedData = await extractPatientData(result.value, doc.name);
                  } else {
                    const blob = new Blob([arrayBuffer], { type: doc.mimeType });
                    const genPart = await fileToGenerativePart(blob);
                    extractedData = await extractPatientData(genPart, doc.name);
                  }
                }
              }
            } catch (aiError) {
              console.error("AI Extraction failed", aiError);
            }

            console.log("AI Extracted Result for Drive File:", extractedData);

            if (targetPatientId) {
              await addAttachmentToExistingPatient(doc.name, doc.id, driveUrl);
            } else {
              await createPatientFromDriveFile(doc, extractedData);
            }
          }

          setUploading(false);
          setUploadStatus("¡Importación completada!");
          if (onImportSuccess) onImportSuccess();
          setTimeout(() => setUploadStatus(""), 3000);
        }
      },
    });
  };

  // --- LOCAL FILE DROP ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;

    setUploading(true);
    setUploadStatus(`Subiendo ${files.length} archivos...`);

    try {
      for (const file of files) {
        setUploadStatus(`Analizando ${file.name} con IA...`);
        let extractedData: Partial<Patient> | null = null;

        try {
          if (
            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            extractedData = await extractPatientData(result.value, file.name);
          } else {
            const genPart = await fileToGenerativePart(file);
            extractedData = await extractPatientData(genPart, file.name);
          }
        } catch (aiError) {
          console.error("Local AI Extraction failed", aiError);
        }

        console.log("AI Extracted Result for", file.name, ":", extractedData);

        if (targetPatientId) {
          await uploadAndAttachToPatient(file);
        } else {
          await uploadAndCreatePatient(file, extractedData);
        }
      }
      setUploadStatus("¡Completado!");
      if (onImportSuccess) onImportSuccess();
    } catch (error) {
      console.error("Upload error", error);
      setUploadStatus("Error al subir.");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadStatus(""), 3000);
    }
  };

  // --- HELPERS ---
  const mergePatientData = (base: Patient, ai: Partial<Patient> | null): Patient => {
    if (!ai) return base;
    const merged = { ...base };

    // Only overwrite if AI actually found something
    if (ai.fullName && ai.fullName.length > 3) merged.fullName = ai.fullName;
    if (ai.rut) merged.rut = ai.rut;
    if (ai.birthDate) merged.birthDate = ai.birthDate;
    if (ai.gender) merged.gender = ai.gender;
    if (ai.medicalHistory && ai.medicalHistory.length > 0)
      merged.medicalHistory = ai.medicalHistory;
    if (ai.surgicalHistory && ai.surgicalHistory.length > 0)
      merged.surgicalHistory = ai.surgicalHistory;
    if (ai.allergies && Array.isArray(ai.allergies)) {
      merged.allergies = ai.allergies.map((a: any) => ({
        id: generateId(),
        type: (a.type || "Otro") as any,
        substance: a.substance || a,
        reaction: a.reaction || "Extraído de archivo",
      }));
    }
    if (ai.medications && Array.isArray(ai.medications)) {
      merged.medications = ai.medications.map((m: any) => ({
        id: generateId(),
        name: m.name || m,
        dose: m.dose || "No especificado",
        frequency: m.frequency || "No especificado",
      }));
    }

    // Habits mapping
    if (ai.smokingStatus) {
      if (ai.smokingStatus.includes("No") || ai.smokingStatus.includes("Abstemio"))
        merged.smokingStatus = "No";
      else if (ai.smokingStatus.includes("Ex") || ai.smokingStatus.includes("Suspendido"))
        merged.smokingStatus = "Suspendido";
      else merged.smokingStatus = "Si";
    }
    if (ai.ipa !== undefined) merged.ipa = Number(ai.ipa) || 0;

    if (ai.alcoholStatus) {
      if (ai.alcoholStatus.includes("No") || ai.alcoholStatus.includes("Abstemio"))
        merged.alcoholStatus = "No";
      else if (ai.alcoholStatus.includes("Ex") || ai.alcoholStatus.includes("Suspendido"))
        merged.alcoholStatus = "Suspendido";
      else merged.alcoholStatus = "Si";
    }

    if (ai.drugUse) {
      if (ai.drugUse.toLowerCase().includes("no")) merged.drugUse = "No";
      else merged.drugUse = "Si";
    }
    if (ai.pets) merged.pets = ai.pets;

    return merged;
  };

  const createPatientFromDriveFile = async (doc: any, extractedData?: Partial<Patient> | null) => {
    const basePatient = buildPatientObject(
      doc.name.replace(/\.[^/.]+$/, ""),
      doc.id,
      doc.url || (doc as any).webViewLink
    );

    // Process extracted consultations if any
    let mappedConsultations: Consultation[] = [];
    if (extractedData?.consultations && Array.isArray(extractedData.consultations)) {
      mappedConsultations = extractedData.consultations.map((c: any) => ({
        id: `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: c.date || new Date().toISOString().split("T")[0],
        reason: c.reason || "Consulta importada",
        anamnesis: c.anamnesis || "",
        physicalExam: "",
        diagnosis: c.diagnosis || "",
        professionalName: c.professionalName || "Profesional Externo",
        professionalId: "imported",
        professionalRole: "MEDICO",
        professionalRut: "",
        prescriptions: [],
        active: true,
      }));
    }

    const mergedPatient = mergePatientData(basePatient as Patient, extractedData);
    const newPatient = {
      ...mergedPatient,
      active: true,
      centerId: activeCenterId || "",
      consultations: [],
      id: undefined,
      driveFileId: doc.id,
      driveFileLink: doc.url || (doc as any).webViewLink || "",
      lastUpdated: new Date().toISOString(),
    };

    await updatePatient(newPatient as any);
  };

  const addAttachmentToExistingPatient = async (name: string, id: string, url: string) => {
    if (!targetPatientId) return;
    const attachment: Attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      type: "other",
      date: new Date().toISOString(),
      url,
      driveId: id,
    };

    const updatedPatient = {
      id: targetPatientId,
      attachments: [...currentAttachments, attachment],
      lastUpdated: new Date().toISOString(),
    };
    await updatePatient(updatedPatient as any);
  };

  const uploadAndAttachToPatient = async (file: File) => {
    if (!currentUser || !targetPatientId) return;
    const storageRef = ref(
      storage,
      `users/${currentUser.uid}/patients/${targetPatientId}/${Date.now()}_${file.name}`
    );
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    const attachment: Attachment = {
      id: `att_${Date.now()}`,
      name: file.name,
      type: file.type.includes("pdf") ? "pdf" : file.type.includes("image") ? "image" : "other",
      date: new Date().toISOString(),
      url: downloadUrl,
    };

    const updatedPatient = {
      id: targetPatientId,
      attachments: [...currentAttachments, attachment],
      lastUpdated: new Date().toISOString(),
    };
    await updatePatient(updatedPatient as any);
  };

  const uploadAndCreatePatient = async (file: File, extractedData?: any | null) => {
    if (!currentUser) return;
    const storageRef = ref(storage, `users/${currentUser.uid}/imports/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    const basePatient = buildPatientObject(
      file.name.replace(/\.[^/.]+$/, ""),
      "local",
      downloadUrl
    );

    // Process extracted consultations if any
    let mappedConsultations: Consultation[] = [];
    if (extractedData?.consultations && Array.isArray(extractedData.consultations)) {
      mappedConsultations = extractedData.consultations.map((c: any) => ({
        id: `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: c.date || new Date().toISOString().split("T")[0],
        reason: c.reason || "Consulta importada",
        anamnesis: c.anamnesis || "",
        physicalExam: "",
        diagnosis: c.diagnosis || "",
        professionalName: c.professionalName || "Profesional Externo",
        professionalId: "imported",
        professionalRole: "MEDICO",
        professionalRut: "",
        prescriptions: [],
        active: true,
      }));
    }

    // Create patient with AI data
    const mergedPatient = mergePatientData(basePatient as Patient, extractedData);
    const newPatient = {
      ...mergedPatient,
      consultations: mappedConsultations,
      id: undefined,
      attachments: [
        {
          id: `att_${Date.now()}`,
          name: file.name,
          type: file.type.includes("pdf") ? "pdf" : file.type.includes("image") ? "image" : "other",
          date: new Date().toISOString(),
          url: downloadUrl,
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    await updatePatient(newPatient as any);
  };

  const buildPatientObject = (name: string, driveId: string, link: string) => ({
    ownerUid: currentUser?.uid || "",
    active: true,
    centerId: activeCenterId || "",
    accessControl: {
      allowedUids: [currentUser?.uid || ""],
      centerIds: activeCenterId ? [activeCenterId] : [],
    },
    fullName: name,
    rut: "",
    birthDate: "",
    gender: "Otro" as const,
    email: "",
    phone: "",
    address: "",
    commune: "",
    medicalHistory: [],
    surgicalHistory: [],
    medications: [],
    allergies: [],
    consultations: [],
    attachments: [],
    lastUpdated: new Date().toISOString(),
    driveFileId: driveId,
    driveFileLink: link,
  });

  return (
    <div
      className={`
                relative border-2 border-dashed rounded-xl p-6 transition-all duration-200
                flex flex-col items-center justify-center gap-2 text-center
                ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 bg-slate-50"}
                ${uploading ? "opacity-70 pointer-events-none" : ""}
                ${targetPatientId ? "p-3 py-4" : "p-6"}
            `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {uploading ? (
        <div className="flex flex-col items-center animate-pulse">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-1" />
          <p className="text-[10px] font-bold text-slate-500 uppercase">{uploadStatus}</p>
        </div>
      ) : uploadStatus === "¡Importación completada!" || uploadStatus === "¡Completado!" ? (
        <div className="flex flex-col items-center text-emerald-600">
          <CheckCircle className="w-6 h-6 mb-1" />
          <p className="text-[10px] font-black uppercase">¡Listo!</p>
        </div>
      ) : (
        <>
          <div
            className={`bg-white rounded-full shadow-sm ${targetPatientId ? "p-1.5" : "p-3"}`}
            onClick={handleOpenPicker}
          >
            <Upload className={`${targetPatientId ? "w-4 h-4" : "w-6 h-6"} text-blue-600`} />
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-bold text-slate-600 uppercase">
              {targetPatientId ? "Subir archivos" : "Arrastra archivos aquí o"}
            </p>
            <button
              onClick={handleOpenPicker}
              className="text-blue-600 hover:text-blue-700 text-[11px] font-black uppercase hover:underline"
            >
              Desde Drive
            </button>
          </div>

          {!targetPatientId && (
            <p className="text-[10px] text-slate-400 max-w-[200px] uppercase font-bold">
              PDF, Word e Imágenes. Se crearán fichas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
