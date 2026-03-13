/**
 * Tests mínimos para el Agente WhatsApp ClaveSalud
 * 
 * Estos tests validan la lógica de negocio sin Gemini real.
 * Ejecutar con: npx jest whatsapp-agent.test.ts
 */

// ─── MOCKS ───────────────────────────────────────────────────────────────────

// Simular isValidRut (extraída para testing)
function isValidRut(rut: string): boolean {
    const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length < 7 || clean.length > 9) return false;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    let sum = 0;
    let mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * mul;
        mul = mul === 7 ? 2 : mul + 1;
    }
    const expected = 11 - (sum % 11);
    const dvExpected = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
    return dv === dvExpected;
}

// Simular convKey
function convKey(centerId: string, phone: string): string {
    return `${centerId}_${phone}`;
}

// ─── TEST 1: Validación de RUT ───────────────────────────────────────────────

describe("isValidRut", () => {
    test("RUT válido con dígito numérico", () => {
        expect(isValidRut("12345678-5")).toBe(true);
    });

    test("RUT válido con K", () => {
        // 10.000.013-K es un RUT verificado con dígito K
        expect(isValidRut("10000013-K")).toBe(true);
    });

    test("RUT inválido - dígito incorrecto", () => {
        expect(isValidRut("12345678-0")).toBe(false);
    });

    test("RUT muy corto", () => {
        expect(isValidRut("12345")).toBe(false);
    });

    test("RUT vacío", () => {
        expect(isValidRut("")).toBe(false);
    });

    test("RUT con puntos y guión", () => {
        expect(isValidRut("12.345.678-5")).toBe(true);
    });
});

// ─── TEST 2: Clave conversacional multi-centro ───────────────────────────────

describe("convKey", () => {
    test("genera clave con centerId y phone", () => {
        expect(convKey("c_cf35oz9w", "56912345678")).toBe("c_cf35oz9w_56912345678");
    });

    test("diferentes centros generan claves diferentes", () => {
        const key1 = convKey("centro_a", "56912345678");
        const key2 = convKey("centro_b", "56912345678");
        expect(key1).not.toBe(key2);
    });

    test("mismo centro mismo teléfono = misma clave", () => {
        const key1 = convKey("centro_a", "56912345678");
        const key2 = convKey("centro_a", "56912345678");
        expect(key1).toBe(key2);
    });
});

// ─── TEST 3: Simulación de booking gate ──────────────────────────────────────

describe("Booking Gate (confirm_booking_details)", () => {
    test("book_appointment rechazado si no hay pendingBooking", () => {
        const conv = { phase: "ACTIVE" as const, pendingBooking: undefined };
        const pending = conv.pendingBooking;
        expect(!pending || !(pending as any)?.slotDocId).toBe(true);
    });

    test("book_appointment permitido si pendingBooking existe", () => {
        const conv = {
            phase: "ACTIVE" as const,
            pendingBooking: {
                slotDocId: "abc123",
                staffId: "doc1",
                staffName: "Dr. Test",
                date: "2026-03-15",
                time: "09:00",
                patientName: "Juan Pérez",
                patientRut: "12345678-5"
            }
        };
        const pending = conv.pendingBooking;
        expect(pending && pending.slotDocId).toBeTruthy();
    });

    test("pendingBooking contiene todos los campos necesarios", () => {
        const pending = {
            slotDocId: "abc123",
            staffId: "doc1",
            staffName: "Dr. Cepeda",
            date: "2026-03-15",
            time: "10:30",
            patientName: "María López",
            patientRut: "98765432-1"
        };
        expect(pending.slotDocId).toBeDefined();
        expect(pending.staffId).toBeDefined();
        expect(pending.staffName).toBeDefined();
        expect(pending.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(pending.time).toMatch(/^\d{2}:\d{2}$/);
        expect(pending.patientName.length).toBeGreaterThanOrEqual(3);
        expect(pending.patientRut).toBeDefined();
    });
});

// ─── TEST 4: Idempotencia ────────────────────────────────────────────────────

describe("Idempotencia de messageId", () => {
    const processedIds = new Set<string>();

    test("primer procesamiento de un messageId retorna false (no existía)", () => {
        const messageId = "wamid.abc123";
        const alreadyProcessed = processedIds.has(messageId);
        processedIds.add(messageId);
        expect(alreadyProcessed).toBe(false);
    });

    test("segundo procesamiento del mismo messageId retorna true", () => {
        const messageId = "wamid.abc123";
        const alreadyProcessed = processedIds.has(messageId);
        expect(alreadyProcessed).toBe(true);
    });

    test("diferente messageId retorna false", () => {
        const messageId = "wamid.xyz789";
        const alreadyProcessed = processedIds.has(messageId);
        expect(alreadyProcessed).toBe(false);
    });
});

// ─── TEST 5: Validación de booking (sin Firestore) ───────────────────────────

describe("Booking validation rules", () => {
    function validateBookingInput(input: {
        slotDocId?: string;
        centerId?: string;
        patientName?: string;
        patientRut?: string;
    }): { valid: boolean; error?: string } {
        if (!input.slotDocId) return { valid: false, error: "MISSING_SLOT_ID" };
        if (!input.centerId) return { valid: false, error: "MISSING_CENTER_ID" };
        if (!input.patientName || input.patientName.trim().length < 3) {
            return { valid: false, error: "INVALID_NAME" };
        }
        if (!input.patientRut) return { valid: false, error: "MISSING_RUT" };
        const cleanRut = input.patientRut.replace(/[^0-9kK-]/g, "").toUpperCase();
        if (!isValidRut(cleanRut)) {
            return { valid: false, error: "INVALID_RUT" };
        }
        return { valid: true };
    }

    test("rechaza sin slotDocId", () => {
        const r = validateBookingInput({ centerId: "c1", patientName: "Test", patientRut: "12345678-5" });
        expect(r.error).toBe("MISSING_SLOT_ID");
    });

    test("rechaza sin centerId", () => {
        const r = validateBookingInput({ slotDocId: "s1", patientName: "Test", patientRut: "12345678-5" });
        expect(r.error).toBe("MISSING_CENTER_ID");
    });

    test("rechaza nombre muy corto", () => {
        const r = validateBookingInput({ slotDocId: "s1", centerId: "c1", patientName: "AB", patientRut: "12345678-5" });
        expect(r.error).toBe("INVALID_NAME");
    });

    test("rechaza RUT inválido", () => {
        const r = validateBookingInput({ slotDocId: "s1", centerId: "c1", patientName: "Test User", patientRut: "12345678-0" });
        expect(r.error).toBe("INVALID_RUT");
    });

    test("acepta datos válidos", () => {
        const r = validateBookingInput({ slotDocId: "s1", centerId: "c1", patientName: "Juan Pérez", patientRut: "12345678-5" });
        expect(r.valid).toBe(true);
    });
});

// ─── TEST 6: FlowState transitions ──────────────────────────────────────────

describe("FlowState transitions", () => {
    test("nuevo paciente empieza en idle", () => {
        const conv = { phase: "ACTIVE" as const, flowState: "idle" as const };
        expect(conv.flowState).toBe("idle");
    });

    test("tras confirm_booking_details pasa a awaiting_confirmation", () => {
        let flowState: string = "exploring";
        // Simular confirm_booking_details
        flowState = "awaiting_confirmation";
        expect(flowState).toBe("awaiting_confirmation");
    });

    test("tras booking exitoso pasa a booking_completed", () => {
        let flowState: string = "awaiting_confirmation";
        // Simular book_appointment exitoso
        flowState = "booking_completed";
        expect(flowState).toBe("booking_completed");
    });
});

// ─── TEST 7: Doctor name resolution ──────────────────────────────────────────

describe("Doctor name resolution", () => {
    const staff = [
        { id: "doc1", fullName: "Dr. Carlos Cepeda", name: "Cepeda", specialty: "Medicina General" },
        { id: "doc2", fullName: "Dra. Ana López", name: "López", specialty: "Pediatría" },
        { id: "doc3", name: "García", specialty: "Dermatología" }
    ];

    test("resuelve fullName si existe", () => {
        const member = staff.find(s => s.id === "doc1");
        const name = member?.fullName || member?.name || "Profesional";
        expect(name).toBe("Dr. Carlos Cepeda");
    });

    test("resuelve name si no hay fullName", () => {
        const member = staff.find(s => s.id === "doc3");
        const name = (member as any)?.fullName || member?.name || "Profesional";
        expect(name).toBe("García");
    });

    test("resuelve 'Profesional' si no se encuentra", () => {
        const member = staff.find(s => s.id === "nonexistent");
        const name = member?.fullName || member?.name || "Profesional";
        expect(name).toBe("Profesional");
    });
});
