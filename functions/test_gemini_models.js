const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyATMu31he1IBgUZZWcBAhXHhkiDJb07f34");
async function run() {
    try {
        const models = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyATMu31he1IBgUZZWcBAhXHhkiDJb07f34");
        const data = await models.json();
        console.log("AVAILABLE MODELS:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("ERROR:", err.message);
    }
}
run();
