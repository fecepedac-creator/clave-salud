import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
    },
    define: {
      "process.env": {
        FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
        FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
        FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET,
        FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID,
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;

            if (
              id.includes("firebase/") ||
              id.includes("@firebase/")
            ) {
              return "firebase";
            }

            if (id.includes("lucide-react")) return "icons";
            if (id.includes("react-google-drive-picker")) return "drive-picker";
            if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf-export";
            if (id.includes("qrcode")) return "qrcode";
            if (id.includes("mammoth")) return "doc-import";
            if (id.includes("@google/generative-ai")) return "gemini-sdk";

            if (
              id.includes("/react/") ||
              id.includes("\\react\\") ||
              id.includes("/react-dom/") ||
              id.includes("\\react-dom\\")
            ) {
              return "vendor";
            }

            return undefined;
          },
        },
      },
    },
  };
});
