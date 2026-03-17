const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyATMu31he1IBgUZZWcBAhXHhkiDJb07f34");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
model
  .generateContent("hello")
  .then((res) => console.log(res.response.text()))
  .catch((err) => console.error("ERROR:", err.message));
