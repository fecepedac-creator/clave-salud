import React, { useState, useEffect, useContext } from "react";
import { Patient, Medication, Allergy, Preadmission } from "../types";
import {
  MEDICAL_HISTORY_OPTIONS,
  SURGICAL_HISTORY_OPTIONS,
  LIVING_WITH_OPTIONS,
  MAULE_COMMUNES,
} from "../constants";
import {
  validateRUT,
  formatRUT,
  generateId,
  capitalizeWords,
  sanitizeText,
  formatChileanPhone,
  extractChileanPhoneDigits,
} from "../utils";
import { CenterContext } from "../CenterContext";
import {
  Check,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Save,
  AlertCircle,
  User,
  Activity,
  Pill,
  Users,
  MapPin,
} from "lucide-react";
import LogoHeader from "./LogoHeader";

interface PatientFormProps {
  onSave: (patient: Patient) => void;
  onCancel: () => void;
  existingPatients: Patient[]; // Added prop to check for existing data
  existingPreadmissions?: Preadmission[];
  prefillContact?: { name: string; rut: string; phone: string; email?: string } | null;
}

// --- Helper Components defined OUTSIDE the main component to prevent re-renders ---

const SectionTitle = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-slate-100">
    <div className="bg-blue-100 p-2 rounded-lg">
      <Icon className="w-8 h-8 text-blue-700" />
    </div>
    <h3 className="text-2xl md:text-3xl font-bold text-slate-800">{title}</h3>
  </div>
);

const BigInput = ({ label, value, onChange, placeholder, type = "text", error }: any) => (
  <div className="mb-4">
    <label className="block text-xl font-bold text-slate-700 mb-2">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full p-4 text-xl border-2 rounded-xl outline-none transition-all ${error ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"}`}
    />
    {error && (
      <p className="text-red-600 font-bold mt-1 text-sm flex items-center gap-1">
        <AlertCircle className="w-4 h-4" /> {error}
      </p>
    )}
  </div>
);

const SelectionCard = ({ label, selected, onClick }: any) => (
  <button
    onClick={onClick}
    className={`p-4 md:p-6 rounded-2xl border-2 text-left transition-all flex items-center justify-between group shadow-sm hover:shadow-md ${selected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 hover:border-blue-300 bg-white"}`}
  >
    <span
      className={`text-lg md:text-xl font-bold ${selected ? "text-blue-800" : "text-slate-600 group-hover:text-slate-800"}`}
    >
      {label}
    </span>
    <div
      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}
    >
      {selected && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
    </div>
  </button>
);

const PatientForm: React.FC<PatientFormProps> = ({
  onSave,
  onCancel,
  existingPatients,
  existingPreadmissions = [],
  prefillContact = null,
}) => {
  const { activeCenterId } = useContext(CenterContext);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Personal Data
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState(""); // NEW
  const [commune, setCommune] = useState(""); // NEW
  const [gender, setGender] = useState<any>("Masculino");
  const [occupation, setOccupation] = useState("");
  const [livingWith, setLivingWith] = useState<string[]>([]);

  // 2. Medical History
  const [medicalHistory, setMedicalHistory] = useState<string[]>([]);
  const [cancerDetails, setCancerDetails] = useState("");
  const [otherMedicalDetails, setOtherMedicalDetails] = useState("");

  const [surgicalHistory, setSurgicalHistory] = useState<string[]>([]);
  const [herniaDetails, setHerniaDetails] = useState("");
  const [otherSurgicalDetails, setOtherSurgicalDetails] = useState("");

  // 3. Habits
  const [smoking, setSmoking] = useState<any>("No fumador");
  const [cigsPerDay, setCigsPerDay] = useState<string>("");
  const [yearsSmoking, setYearsSmoking] = useState<string>("");
  const [ipa, setIpa] = useState<number>(0);

  const [alcohol, setAlcohol] = useState<any>("No consumo");
  const [alcoholFreq, setAlcoholFreq] = useState<any>("");

  const [drugUse, setDrugUse] = useState<any>("No"); // NEW
  const [drugDetails, setDrugDetails] = useState(""); // NEW

  // 4. Meds & Allergies
  const [medications, setMedications] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);

  // AUTOCOMPLETE EFFECT
  useEffect(() => {
    if (!validateRUT(rut)) return;

    const found = existingPatients.find((p) => p.rut === rut);
    if (found) {
      // SECURITY UPDATE: Only fill non-sensitive identification data.
      setFullName(found.fullName || "");
      setPhoneDigits(extractChileanPhoneDigits(found.phone || ""));
      setEmail(found.email || "");
      // Only overwrite birthdate if existing record has a valid one (not just generated today)
      if (found.birthDate) setBirthDate(found.birthDate);

      setAddress(found.address || "");
      setCommune(found.commune || "");
      setGender(found.gender || "Masculino");
      setOccupation(found.occupation || "");

      // SENSITIVE DATA IS NOT LOADED TO PROTECT PRIVACY
      // Users must re-enter clinical data if they are doing a new admission form.
      // setLivingWith(found.livingWith || []);
      // setMedicalHistory(found.medicalHistory || []); ... etc
      return;
    }

    const preadmission = existingPreadmissions.find((item) => {
      const draftRut = item.patientDraft?.rut;
      const contactRut = item.contact?.rut;
      return draftRut === rut || contactRut === rut;
    });

    if (preadmission) {
      const draft = preadmission.patientDraft;
      const contact = preadmission.contact;
      const name = draft?.fullName ?? contact?.name ?? "";
      const phone = draft?.phone ?? contact?.phone ?? "";
      const emailValue = draft?.email ?? contact?.email ?? "";

      if (name) setFullName(name);
      if (phone) setPhoneDigits(extractChileanPhoneDigits(phone));
      if (emailValue) setEmail(emailValue);
      return;
    }

    if (prefillContact && prefillContact.rut === rut) {
      setFullName(prefillContact.name || "");
      setPhoneDigits(extractChileanPhoneDigits(prefillContact.phone || ""));
      if (prefillContact.email) setEmail(prefillContact.email);
    }
  }, [rut, existingPatients, existingPreadmissions, prefillContact]);

  // IPA Calculation Effect
  useEffect(() => {
    if (smoking !== "No fumador" && cigsPerDay && yearsSmoking) {
      const cigs = parseInt(cigsPerDay) || 0;
      const years = parseInt(yearsSmoking) || 0;
      setIpa((cigs * years) / 20);
    } else {
      setIpa(0);
    }
  }, [cigsPerDay, yearsSmoking, smoking]);

  const toggleSelection = (list: string[], setList: any, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const newErrors: Record<string, string> = {};
      if (!fullName) newErrors.fullName = "Debe escribir su nombre.";
      if (!rut || !validateRUT(rut)) newErrors.rut = "El RUT no es válido.";
      if (!birthDate) newErrors.birthDate = "Indique su fecha de nacimiento.";
      if (!phoneDigits && !email) newErrors.contact = "Indique teléfono o email de contacto.";
      if (phoneDigits && phoneDigits.length !== 8)
        newErrors.contact = "El teléfono debe tener 8 dígitos.";
      if (!address) newErrors.address = "La dirección es importante para la receta.";
      if (!commune) newErrors.commune = "Seleccione su comuna.";
      if (livingWith.length === 0) newErrors.livingWith = "Seleccione al menos una opción.";

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) {
        window.scrollTo(0, 0);
        return;
      }
    }
    setStep(step + 1);
    window.scrollTo(0, 0);
  };

  const handleSave = () => {
    if (!activeCenterId) {
      alert("⚠️ Debes seleccionar un Centro activo antes de crear/editar pacientes.");
      return;
    }

    // Sanitize and Format
    const finalFullName = capitalizeWords(sanitizeText(fullName));
    const finalAddress = capitalizeWords(sanitizeText(address));
    const finalOccupation = capitalizeWords(sanitizeText(occupation));
    const finalDrugDetails =
      drugUse === "Si" && drugDetails ? capitalizeWords(sanitizeText(drugDetails)) : undefined;
    const finalMedicalDetails = otherMedicalDetails
      ? capitalizeWords(sanitizeText(otherMedicalDetails))
      : undefined;
    const finalCancerDetails = cancerDetails
      ? capitalizeWords(sanitizeText(cancerDetails))
      : undefined;
    const finalSurgicalDetails = otherSurgicalDetails
      ? capitalizeWords(sanitizeText(otherSurgicalDetails))
      : undefined;
    const finalHerniaDetails = herniaDetails
      ? capitalizeWords(sanitizeText(herniaDetails))
      : undefined;

    const newPatient: Patient = {
      id: generateId(),
      centerId: activeCenterId,
      rut,
      fullName: finalFullName,
      birthDate,
      gender,
      phone: formatChileanPhone(phoneDigits),
      email,
      address: finalAddress,
      commune,
      occupation: finalOccupation,
      livingWith,
      medicalHistory,
      medicalHistoryDetails: finalMedicalDetails,
      cancerDetails: finalCancerDetails,
      surgicalHistory,
      surgicalHistoryDetails: finalSurgicalDetails,
      herniaDetails: finalHerniaDetails,

      smokingStatus: smoking,
      cigarettesPerDay: cigsPerDay ? parseInt(cigsPerDay) : undefined,
      yearsSmoking: yearsSmoking ? parseInt(yearsSmoking) : undefined,
      packYearsIndex: ipa,

      alcoholStatus: alcohol,
      alcoholFrequency: alcohol === "No consumo" ? undefined : alcoholFreq,

      drugUse: drugUse,
      drugDetails: finalDrugDetails,

      medications,
      allergies,
      consultations: [],
      attachments: [],
      lastUpdated: new Date().toISOString(),
    };
    onSave(newPatient);
  };

  const addMedication = () => {
    setMedications([...medications, { id: generateId(), name: "", dose: "", frequency: "" }]);
  };

  const updateMedication = (id: string, field: keyof Medication, value: string) => {
    setMedications(medications.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeMedication = (id: string) => {
    setMedications(medications.filter((m) => m.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto min-h-screen sm:min-h-0 sm:my-8 pb-20">
      {/* Logo Header */}
      <div className="bg-white px-6 py-4 sm:rounded-t-3xl border-b border-slate-100">
        <LogoHeader size="md" showText={true} />
      </div>

      {/* Progress Bar */}
      <div className="bg-white sticky top-0 z-20 px-6 py-4 shadow-sm border-b border-slate-100 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            Progreso del Registro
          </span>
          <span className="text-blue-600 font-bold">Paso {step} de 3</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white sm:rounded-b-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-10 space-y-10">
          {/* STEP 1: Personal Data */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <SectionTitle icon={User} title="Sus Datos Personales" />
              <p className="text-slate-500 text-lg mb-8">
                Por favor, escriba sus datos tal como aparecen en su carnet.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* RUT MOVED TO FIRST POSITION FOR BETTER UX (AUTOCOMPLETE) */}
                <div className="md:col-span-2">
                  <BigInput
                    label="RUT (Al ingresarlo cargaremos sus datos si existen)"
                    value={rut}
                    onChange={(e: any) => setRut(formatRUT(e.target.value))}
                    placeholder="12.345.678-9"
                    error={errors.rut}
                  />
                </div>

                <div className="md:col-span-2">
                  <BigInput
                    label="Nombre Completo"
                    value={fullName}
                    onChange={(e: any) => setFullName(e.target.value)}
                    error={errors.fullName}
                  />
                </div>

                <BigInput
                  label="Fecha de Nacimiento"
                  type="date"
                  value={birthDate}
                  onChange={(e: any) => setBirthDate(e.target.value)}
                  error={errors.birthDate}
                />

                <div className="mb-4">
                  <label className="block text-xl font-bold text-slate-700 mb-2">
                    Teléfono Celular
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-4 py-4 text-xl border-2 rounded-xl border-slate-200 bg-slate-50 text-slate-500 font-bold">
                      +56 9
                    </span>
                    <input
                      type="tel"
                      value={phoneDigits}
                      onChange={(e: any) =>
                        setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))
                      }
                      placeholder="12345678"
                      className={`w-full p-4 text-xl border-2 rounded-xl outline-none transition-all ${errors.contact ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"}`}
                    />
                  </div>
                  {errors.contact && (
                    <p className="text-red-600 font-bold mt-1 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.contact}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xl font-bold text-slate-700 mb-2">
                    Dirección de Residencia
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle, Número, Villa/Población"
                      className={`w-full p-4 text-xl border-2 rounded-xl outline-none transition-all ${errors.address ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-blue-500"}`}
                    />
                    <select
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      className={`w-full p-4 text-xl border-2 rounded-xl outline-none transition-all bg-white ${errors.commune ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-blue-500"}`}
                    >
                      <option value="">Seleccione Comuna (Maule)</option>
                      {MAULE_COMMUNES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(errors.address || errors.commune) && (
                    <p className="text-red-600 font-bold mt-1 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Dirección completa requerida para recetas.
                    </p>
                  )}
                </div>

                <BigInput
                  label="Correo Electrónico (Opcional)"
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  error={errors.contact}
                />

                <div className="md:col-span-2">
                  <label className="block text-xl font-bold text-slate-700 mb-4">Sexo</label>
                  <div className="grid grid-cols-3 gap-4">
                    {["Masculino", "Femenino", "Otro"].map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`py-4 text-lg font-bold rounded-xl border-2 transition-all ${gender === g ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                  <BigInput
                    label="Ocupación / Oficio"
                    value={occupation}
                    onChange={(e: any) => setOccupation(e.target.value)}
                    placeholder="Ej: Profesor, Dueña de casa..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" /> ¿Con quién vive?{" "}
                    <span className="text-sm font-normal text-slate-400">
                      (Puede marcar varios)
                    </span>
                  </label>
                  {errors.livingWith && (
                    <p className="text-red-600 font-bold mb-2 text-sm">{errors.livingWith}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {LIVING_WITH_OPTIONS.map((opt) => (
                      <SelectionCard
                        key={opt}
                        label={opt}
                        selected={livingWith.includes(opt)}
                        onClick={() => toggleSelection(livingWith, setLivingWith, opt)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Medical History */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <SectionTitle icon={Activity} title="Antecedentes de Salud" />
              <p className="text-slate-500 text-lg mb-8">
                Seleccione las opciones tocando los recuadros correspondientes.
              </p>

              {/* Patologías */}
              <div className="mb-10">
                <h4 className="text-xl font-bold text-slate-800 mb-4 bg-slate-100 p-3 rounded-lg inline-block">
                  ¿Tiene alguna de estas enfermedades?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MEDICAL_HISTORY_OPTIONS.map((item) => (
                    <SelectionCard
                      key={item.id}
                      label={item.label}
                      selected={medicalHistory.includes(item.id)}
                      onClick={() => toggleSelection(medicalHistory, setMedicalHistory, item.id)}
                    />
                  ))}
                </div>

                {medicalHistory.includes("CANCER") && (
                  <div className="mt-4 p-6 bg-red-50 rounded-2xl border-2 border-red-100">
                    <label className="block text-xl font-bold text-red-800 mb-2">
                      ¿Qué tipo de cáncer?
                    </label>
                    <input
                      value={cancerDetails}
                      onChange={(e) => setCancerDetails(e.target.value)}
                      className="w-full p-4 text-lg border-2 border-red-200 rounded-xl focus:border-red-400 outline-none"
                      placeholder="Ej: Mama, Próstata..."
                    />
                  </div>
                )}
                {medicalHistory.includes("OTRO") && (
                  <div className="mt-4 p-6 bg-slate-50 rounded-2xl border-2 border-slate-200">
                    <label className="block text-xl font-bold text-slate-700 mb-2">
                      ¿Qué otra enfermedad?
                    </label>
                    <textarea
                      value={otherMedicalDetails}
                      onChange={(e) => setOtherMedicalDetails(e.target.value)}
                      className="w-full p-4 text-lg border-2 border-slate-300 rounded-xl"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Cirugías */}
              <div className="mb-10">
                <h4 className="text-xl font-bold text-slate-800 mb-4 bg-slate-100 p-3 rounded-lg inline-block">
                  ¿Le han realizado cirugías?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SURGICAL_HISTORY_OPTIONS.map((item) => (
                    <SelectionCard
                      key={item.id}
                      label={item.label}
                      selected={surgicalHistory.includes(item.id)}
                      onClick={() => toggleSelection(surgicalHistory, setSurgicalHistory, item.id)}
                    />
                  ))}
                </div>
                {surgicalHistory.includes("HERNIA") && (
                  <div className="mt-4 p-6 bg-indigo-50 rounded-2xl border-2 border-indigo-100">
                    <label className="block text-xl font-bold text-indigo-900 mb-2">
                      ¿Dónde fue la hernia?
                    </label>
                    <input
                      value={herniaDetails}
                      onChange={(e) => setHerniaDetails(e.target.value)}
                      className="w-full p-4 text-lg border-2 border-indigo-200 rounded-xl"
                      placeholder="Ej: Inguinal..."
                    />
                  </div>
                )}
              </div>

              {/* Habits */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                  <h4 className="text-xl font-bold text-slate-800 mb-4">Consumo de Tabaco</h4>
                  <div className="flex flex-col gap-3">
                    {["No fumador", "Ex fumador", "Fumador actual"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setSmoking(opt);
                          if (opt === "No fumador") {
                            setCigsPerDay("");
                            setYearsSmoking("");
                          }
                        }}
                        className={`p-4 rounded-xl text-lg font-bold border-2 text-left transition-all ${smoking === opt ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {smoking !== "No fumador" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="font-bold text-slate-600">Cigarros al día</label>
                        <input
                          type="number"
                          value={cigsPerDay}
                          onChange={(e) => setCigsPerDay(e.target.value)}
                          className="w-full p-3 border-2 rounded-xl text-lg"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600">Años fumando</label>
                        <input
                          type="number"
                          value={yearsSmoking}
                          onChange={(e) => setYearsSmoking(e.target.value)}
                          className="w-full p-3 border-2 rounded-xl text-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-orange-50 p-6 rounded-3xl border-2 border-orange-100">
                  <h4 className="text-xl font-bold text-orange-900 mb-4">Consumo de Alcohol</h4>
                  <div className="flex flex-col gap-3">
                    {["No consumo", "Ocasional", "Frecuente"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAlcohol(opt)}
                        className={`p-4 rounded-xl text-lg font-bold border-2 text-left transition-all ${alcohol === opt ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-500 border-orange-200"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drugs Section - NEW */}
              <div className="mt-8 bg-purple-50 p-6 rounded-3xl border-2 border-purple-100">
                <h4 className="text-xl font-bold text-purple-900 mb-4">Consumo de Drogas</h4>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col gap-3 flex-1">
                    {["No", "Si"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setDrugUse(opt);
                          if (opt === "No") setDrugDetails("");
                        }}
                        className={`p-4 rounded-xl text-lg font-bold border-2 text-left transition-all ${drugUse === opt ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-500 border-purple-200"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {drugUse === "Si" && (
                    <div className="flex-1 bg-white p-4 rounded-xl border border-purple-200">
                      <label className="block font-bold text-purple-900 mb-2">
                        ¿Cuál y con qué frecuencia?
                      </label>
                      <textarea
                        className="w-full p-3 border-2 border-purple-100 rounded-xl outline-none focus:border-purple-400 h-24"
                        placeholder="Ej: Marihuana fines de semana..."
                        value={drugDetails}
                        onChange={(e) => setDrugDetails(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Meds & Finish */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <SectionTitle icon={Pill} title="Medicamentos y Alergias" />

              <div className="bg-blue-50 p-6 md:p-8 rounded-3xl border-2 border-blue-100 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h4 className="text-2xl font-bold text-blue-900">Medicamentos que toma</h4>
                    <p className="text-blue-700">Incluya remedios recetados y vitaminas.</p>
                  </div>
                  <button
                    onClick={addMedication}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Plus className="w-6 h-6" /> Agregar Medicamento
                  </button>
                </div>

                {medications.length === 0 ? (
                  <div className="text-center py-10 bg-white/50 rounded-2xl border-2 border-dashed border-blue-200">
                    <p className="text-xl text-blue-400 font-medium">
                      No ha agregado medicamentos aún.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {medications.map((med, idx) => (
                      <div
                        key={med.id}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 relative"
                      >
                        <div className="absolute -left-3 top-6 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
                          {idx + 1}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4">
                          <div className="md:col-span-3 lg:col-span-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">
                              Nombre
                            </label>
                            <input
                              placeholder="Ej. Losartán"
                              value={med.name}
                              onChange={(e) => updateMedication(med.id, "name", e.target.value)}
                              className="w-full text-lg font-bold text-slate-800 border-b-2 border-slate-100 focus:border-blue-500 outline-none py-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">
                              Dosis
                            </label>
                            <input
                              placeholder="Ej. 50mg"
                              value={med.dose}
                              onChange={(e) => updateMedication(med.id, "dose", e.target.value)}
                              className="w-full text-lg text-slate-800 border-b-2 border-slate-100 focus:border-blue-500 outline-none py-1"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="text-xs font-bold text-slate-400 uppercase">
                                Frecuencia
                              </label>
                              <input
                                placeholder="Ej. 1 al día"
                                value={med.frequency}
                                onChange={(e) =>
                                  updateMedication(med.id, "frequency", e.target.value)
                                }
                                className="w-full text-lg text-slate-800 border-b-2 border-slate-100 focus:border-blue-500 outline-none py-1"
                              />
                            </div>
                            <button
                              onClick={() => removeMedication(med.id)}
                              className="bg-red-100 text-red-600 p-3 rounded-xl hover:bg-red-200"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 p-6 md:p-8 rounded-3xl border-2 border-yellow-100">
                <h4 className="text-2xl font-bold text-yellow-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-8 h-8" /> Alergias
                </h4>
                <p className="text-yellow-800 text-lg mb-4 font-medium">
                  ¿Es alérgico a algún medicamento o comida?
                </p>
                <textarea
                  className="w-full p-4 text-xl border-2 border-yellow-200 rounded-xl focus:border-yellow-500 outline-none bg-white"
                  rows={3}
                  placeholder="Escriba aquí sus alergias..."
                  value={allergies.length > 0 ? allergies[0].substance : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) setAllergies([]);
                    else setAllergies([{ id: "a1", type: "Otro", substance: val, reaction: "" }]);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="bg-slate-50 p-6 md:p-8 border-t border-slate-200 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
          {step === 1 ? (
            <button
              onClick={onCancel}
              className="w-full md:w-auto px-8 py-4 text-slate-500 font-bold text-lg hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          ) : (
            <button
              onClick={() => {
                setStep(step - 1);
                window.scrollTo(0, 0);
              }}
              className="w-full md:w-auto px-8 py-4 text-slate-600 font-bold text-lg bg-white border-2 border-slate-200 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-6 h-6" /> Volver Atrás
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              className="w-full md:w-auto px-12 py-4 bg-blue-600 text-white font-bold text-xl rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-3"
            >
              Siguiente Paso <ArrowRight className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="w-full md:w-auto px-12 py-4 bg-green-600 text-white font-bold text-xl rounded-xl hover:bg-green-700 shadow-xl shadow-green-200 transition-all transform active:scale-95 flex items-center justify-center gap-3"
            >
              <Save className="w-6 h-6" /> Finalizar y Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientForm;
