import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

const API_KEY = "AIzaSyD7y8hKM8khe_PVwjCtmGjd1drfUuDfeEo";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const FICHAS_DIR = "c:\\Users\\fecep\\clave-salud\\fichas-piloto";
const OUTPUT_FILE = "c:\\Users\\fecep\\clave-salud\\extracted_data.json";

// Throttle requests to stay within free tier limits (15 RPM -> 1 request every 4 seconds to be safe)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function extractTextFromDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

async function processFicha(text, fileName) {
  const prompt = `
Actúa como un asistente médico experto en migración de datos clínicos.
Analiza la siguiente ficha clínica extraída de un archivo Word y conviértela a un formato JSON estructurado.

FICHA CLÍNICA (${fileName}):
${text}

INSTRUCCIONES:
1. Extrae con precisión los datos del paciente (Nombre, RUT, Fecha Nacimiento).
2. Identifica antecedentes mórbidos, quirúrgicos, alergias y hábitos.
3. Extrae la lista de medicamentos actuales con sus dosis si están disponibles.
4. Identifica todas las consultas médicas presentes en el texto. Si hay fechas, asócialas a cada consulta. Si es una ficha de seguimiento, detecta la evolución.
5. Si encuentras datos confusos, haz tu mejor esfuerzo por interpretarlos en el contexto médico.

FORMATO DE SALIDA (JSON ÚNICO):
{
  "fileName": "${fileName}",
  "patient": {
    "fullName": "string",
    "rut": "string", // Formato XX.XXX.XXX-X
    "birthDate": "DD/MM/YYYY",
    "age": number, // Si se menciona
    "contact": { "address": "string", "phone": "string", "email": "string" },
    "background": {
      "morbid": ["string"],
      "surgical": ["string"],
      "allergies": "string",
      "habits": { "tobacco": "string", "alcohol": "string", "drugs": "string" },
      "social": "string"
    },
    "medications": [
      { "name": "string", "dose": "string", "frequency": "string" }
    ]
  },
  "consultations": [
    {
      "date": "YYYY-MM-DD", // Estimada o "Unknown"
      "reason": "string",
      "anamnesis": "string",
      "physicalExam": "string",
      "diagnosis": "string",
      "plan": "string",
      "exams": ["string"] // Laboratorio o imágenes solicitados/revisados
    }
  ]
}
Responder SOLO con el JSON válido, sin markdown ni explicaciones adicionales.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonText = response.text();

    // Limpiamos markdown si Gemini lo incluye
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(jsonText);
  } catch (error) {
    console.error(`Error processing with Gemini for ${fileName}:`, error.message);
    return { fileName, error: error.message };
  }
}

async function runBatchMigration() {
  console.log("🚀 Iniciando Migración Batch de Fichas Clínicas...");
  console.log(`📂 Directorio: ${FICHAS_DIR}`);

  try {
    const files = await fs.readdir(FICHAS_DIR);
    const docxFiles = files.filter(file => file.endsWith('.docx'));

    console.log(`📄 Encontrados ${docxFiles.length} archivos .docx`);

    const results = [];

    for (const [index, file] of docxFiles.entries()) {
      console.log(`\n[${index + 1}/${docxFiles.length}] Procesando: ${file}...`);
      const filePath = path.join(FICHAS_DIR, file);

      const text = await extractTextFromDocx(filePath);
      if (!text) continue;

      if (text.length < 50) {
        console.warn(`⚠️ Texto muy corto en ${file}, saltando...`);
        continue;
      }

      const data = await processFicha(text, file);

      if (data.error) {
        console.error(`❌ Falló la extracción para ${file}`);
      } else {
        console.log(`✅ Extracción exitosa: ${data.patient.fullName}`);
        results.push(data);
      }

      // Respetar límites de API gratuita (15 RPM = 4s pausa)
      if (index < docxFiles.length - 1) {
        console.log("⏳ Esperando 4s para respetar límites de API...");
        await delay(4000);
      }
    }

    console.log(`\n💾 Guardando resultados en ${OUTPUT_FILE}...`);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log("✨ Proceso completado exitosamente.");

  } catch (error) {
    console.error("❌ Error fatal:", error);
  }
}

runBatchMigration();
