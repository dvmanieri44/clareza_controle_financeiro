import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: process.env.CI ? ["default", ["junit", { outputFile: process.env.TEST_REPORT_FILE || "reports/unit.xml" }]] : ["default"],
    coverage: {
      provider: "v8",
      include: ["src/lib/domain/{finance,schemas,form,invoice-import,import-rules}.ts", "src/lib/accessibility.ts"],
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
});
