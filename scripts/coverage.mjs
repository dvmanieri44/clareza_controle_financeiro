import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const version = require("vitest/package.json").version;
let providerVersion;
try { providerVersion = require("@vitest/coverage-v8/package.json").version; } catch { /* Ferramenta de cobertura opcional. */ }
if (providerVersion !== version) {
  if (!process.env.npm_execpath) throw new Error("Execute npm run test:coverage para preparar o provedor de cobertura.");
  // A versão vem do Vitest instalado pelo lockfile. Não altera package.json nem o lockfile.
  console.log(`Preparando @vitest/coverage-v8@${version} para esta instalação…`);
  const install = spawnSync(process.execPath, [process.env.npm_execpath, "install", "--no-save", "--ignore-scripts", `@vitest/coverage-v8@${version}`], { stdio: "inherit", env: process.env });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status || 1);
}
const cli = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const run = spawnSync(process.execPath, [cli, "run", "--exclude", "tests/firestore.test.ts", "--coverage"], { stdio: "inherit", env: process.env });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
