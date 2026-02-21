/**
 * Calculates Estimated GFR using MDRD Formula
 * GFR = 175 × (Scr)^-1.154 × (Age)^-0.203 × (0.742 if female) × (1.212 if African American)
 */
export const calculateMDRD = (creatinine: number, age: number, gender: string): number | null => {
    if (!creatinine || creatinine <= 0 || !age) return null;

    let gfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);

    if (gender === "Femenino") {
        gfr *= 0.742;
    }

    return parseFloat(gfr.toFixed(1));
};
