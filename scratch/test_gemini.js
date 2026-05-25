import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
let apiKey = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
  if (match) apiKey = match[1].trim();
}

console.log("Using API Key:", apiKey ? apiKey.substring(0, 10) + "..." : "NONE");

const genAI = new GoogleGenerativeAI(apiKey);

const models = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp"
];

async function testModel(modelName) {
  try {
    console.log(`Testing model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hola, responde con 'OK' si puedes leerme.");
    const response = await result.response;
    console.log(`  => Success for ${modelName}! Response:`, response.text().trim());
    return true;
  } catch (error) {
    console.log(`  => Failed for ${modelName}. Error status: ${error.status || error.message}`);
    return false;
  }
}

async function run() {
  for (const m of models) {
    await testModel(m);
  }
}

run();
