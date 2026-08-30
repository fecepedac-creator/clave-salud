import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "components/**/*.test.{ts,tsx}",
      "src/hooks/**/*.test.{ts,tsx}",
      "src/test/**/*.test.{ts,tsx}",
    ],
    exclude: ["src/test/firestore-rules.test.ts"],
  },
});
