import React, { useState, useCallback, useContext } from "react";
import useDrivePicker from "react-google-drive-picker";
import { useCrudOperations } from "../hooks/useCrudOperations";
import { useAuth } from "../hooks/useAuth";
import { CenterContext } from "../CenterContext";
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Upload, FileUp, Loader2, CheckCircle, XCircle } from "lucide-react";

interface DrivePickerProps {
    onImportSuccess?: () => void;
    clientId: string;
    apiKey: string;
}

export default function DrivePicker({ onImportSuccess, clientId, apiKey }: DrivePickerProps) {
    const [openPicker, authResponse] = useDrivePicker();
    const { currentUser } = useAuth();
    const { activeCenterId } = useContext(CenterContext);

    // Use CRUD, passing activeCenterId correctly
    const { updatePatient } = useCrudOperations(activeCenterId || "", [], () => { });

    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string>("");

    // ... (rest of logic remains same until buildPatientObject) ...




    // --- GOOGLE DRIVE PICKER (POPUP MODE) ---
    const handleOpenPicker = () => {
        openPicker({
            clientId,
            developerKey: apiKey,
            viewId: "DOCS",
            showUploadView: true,
            showUploadFolders: true,
            supportDrives: true,
            multiselect: true,
            setIncludeFolders: true, // Necessary sometimes
            // To ensure popup checks: 
            // The library defaults to popup. User just needs authorized origin in Cloud Console.
            customViews: [
                {
                    viewId: "DOCS",
                    mimeTypes: "application/pdf,application/vnd.google-apps.document,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png",
                }
            ],
            callbackFunction: async (data) => {
                if (data.action === "picked") {
                    setUploading(true);
                    setUploadStatus(`Procesando ${data.docs.length} archivos de Drive...`);

                    for (const doc of data.docs) {
                        await createPatientFromDriveFile(doc);
                    }

                    setUploading(false);
                    setUploadStatus("¡Importación completada!");
                    if (onImportSuccess) onImportSuccess();
                    setTimeout(() => setUploadStatus(""), 3000);
                }
            },
        });
    };

    // --- LOCAL FILE DROP HANDLING ---
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
        setUploadStatus(`Subiendo ${files.length} archivos locales...`);

        try {
            for (const file of files) {
                await uploadAndCreatePatient(file);
            }
            setUploadStatus("¡Importación completada!");
            if (onImportSuccess) onImportSuccess();
        } catch (error) {
            console.error("Upload error", error);
            setUploadStatus("Error al subir archivos.");
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(""), 3000);
        }
    };

    // --- HELPERS ---
    const createPatientFromDriveFile = async (doc: any) => {
        const newPatient = buildPatientObject(
            doc.name.replace(/\.[^/.]+$/, ""), // Name without extension
            doc.id,
            doc.url || doc.webViewLink
        );
        await updatePatient(newPatient as any);
    };

    const uploadAndCreatePatient = async (file: File) => {
        if (!currentUser) return;

        // 1. Upload to Firebase Storage
        // Path: users/{uid}/imports/{filename}
        const storageRef = ref(storage, `users/${currentUser.uid}/imports/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // 2. Create Patient
        const newPatient = buildPatientObject(
            file.name.replace(/\.[^/.]+$/, ""),
            "local_upload",
            downloadUrl
        );

        // @ts-ignore
        newPatient.attachments = [
            {
                id: `att_${Date.now()}`,
                name: file.name,
                type: file.type.includes("pdf") ? "pdf" : "image",
                date: new Date().toISOString(),
                url: downloadUrl
            }
        ];

        await updatePatient(newPatient as any);
    };



    const buildPatientObject = (name: string, driveId: string, link: string) => ({
        id: undefined,
        ownerUid: currentUser?.uid || "",
        accessControl: {
            allowedUids: [currentUser?.uid || ""],
            centerIds: activeCenterId ? [activeCenterId] : [], // Link to current center
        },
        fullName: name,
        rut: "",
        birthDate: "",
        gender: "Otro",
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
                flex flex-col items-center justify-center gap-4 text-center
                ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'}
                ${uploading ? 'opacity-70 pointer-events-none' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {uploading ? (
                <div className="flex flex-col items-center animate-pulse">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                    <p className="text-sm font-medium text-slate-600">{uploadStatus}</p>
                </div>
            ) : uploadStatus === "¡Importación completada!" ? (
                <div className="flex flex-col items-center text-green-600">
                    <CheckCircle className="w-10 h-10 mb-2" />
                    <p className="font-bold">¡Archivos Importados!</p>
                </div>
            ) : (
                <>
                    <div className="bg-white p-3 rounded-full shadow-sm">
                        <Upload className="w-6 h-6 text-blue-600" />
                    </div>

                    <div className="space-y-1">
                        <p className="font-medium text-slate-700">
                            Arrastra archivos aquí o
                        </p>
                        <button
                            onClick={handleOpenPicker}
                            className="text-blue-600 hover:text-blue-700 font-bold hover:underline"
                        >
                            selecciona desde Drive
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 max-w-[200px]">
                        Soporta PDF, Word e Imágenes. Se crearán fichas automáticamente.
                    </p>
                </>
            )}
        </div>
    );
}
