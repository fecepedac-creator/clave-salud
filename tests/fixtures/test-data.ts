/**
 * ClaveSalud — Datos de prueba para Playwright E2E
 *
 * IMPORTANTE: Los valores con comentario "[seed]" son los que el seed script
 * escribe en Firestore. Las aserciones numéricas están ligadas a esos datos.
 * Ver: tests/fixtures/seed-data.md para el detalle completo del dataset.
 */

export const TEST = {
  CENTER_ID: process.env.TEST_CENTER_ID || "c_eji2qv61",
  DOCTOR_ID: process.env.TEST_DOCTOR_ID || "doctor_test_uid_001",
  DOCTOR_B_ID: process.env.TEST_DOCTOR_B_ID || "doctor_test_uid_002",
  YEAR_MONTH: process.env.TEST_YEAR_MONTH || "2026-03",
  BASE_URL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5175",
} as const;

export const AUTH = {
  ADMIN: {
    email: process.env.ADMIN_EMAIL || "",
    password: process.env.ADMIN_PASSWORD || "",
  },
  DOCTOR: {
    email: process.env.DOCTOR_EMAIL || "",
    password: process.env.DOCTOR_PASSWORD || "",
  },
  DOCTOR_B: {
    email: process.env.DOCTOR_B_EMAIL || "",
    password: process.env.DOCTOR_B_PASSWORD || "",
  },
} as const;

/**
 * Valores seeded en Firestore para el mes TEST.YEAR_MONTH.
 * Deben coincidir con lo que inserta el seed script.
 * Si los datos cambian en Firestore, actualizar estos valores.
 */
export const SEED = {
  /** stats_professional_month/{TEST.DOCTOR_ID}_{TEST.YEAR_MONTH} */
  DOCTOR_STATS: {
    totalAppointments: 10, // [seed] 10 citas agendadas
    completed: 7, // [seed] 7 atendidas
    noShow: 2, // [seed] 2 inasistencias
    cancelled: 1, // [seed] 1 cancelada
    billableCount: 7, // [seed] todas las completadas = facturables
    totalAmountBillable: 350000, // [seed] 7 x $50.000 CLP
  },
  /** stats_center_month/{TEST.YEAR_MONTH} — suma de todos los doctores */
  CENTER_STATS: {
    totalAppointments: 10, // [seed] solo 1 doctor en dataset mínimo
    completed: 7,
    totalAmountBillable: 350000,
  },
  /** Cita reservada seeded para Test 4 (Closed Month Guard)
   *  Debe existir en Firestore como appointments doc con status="booked" */
  BOOKED_SLOT: {
    /** Fecha en formato YYYY-MM-DD — debe pertenecer al mes de TEST_YEAR_MONTH */
    date: "2026-03-05",
    /** Horario de la cita seeded, sin dos puntos en data-testid (ej: "0900") */
    time: "09:00",
  },
} as const;
