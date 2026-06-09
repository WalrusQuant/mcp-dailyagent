import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Run tests in a UTC+ timezone by default so local-parse/UTC-emit date bugs
// fail in CI instead of only on users' machines. Override with TZ=... if needed.
process.env.TZ = process.env.TZ || "Pacific/Auckland";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
