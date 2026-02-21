export const validateRUT = (rut: string): boolean => {
    if (!rut) return false;

    const cleanRut = rut.replace(/[^0-9kK]/g, "");
    if (cleanRut.length < 2) return false;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();

    // Validate body is a number
    if (!/^\d+$/.test(body)) return false;

    let suma = 0;
    let multiplo = 2;

    for (let i = 1; i <= body.length; i++) {
        const index = multiplo * parseInt(body.charAt(body.length - i));
        suma = suma + index;
        if (multiplo < 7) {
            multiplo = multiplo + 1;
        } else {
            multiplo = 2;
        }
    }

    const dvEsperado = 11 - (suma % 11);
    let dvCalculado = "";

    if (dvEsperado === 11) {
        dvCalculado = "0";
    } else if (dvEsperado === 10) {
        dvCalculado = "K";
    } else {
        dvCalculado = dvEsperado.toString();
    }

    return dv === dvCalculado;
};
