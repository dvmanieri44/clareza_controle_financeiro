import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const prefix = process.env.PAGES_BASE_PATH ?? "/clareza_controle_financeiro";
const routes = ["", "login", "dashboard", "transacoes", "contas", "cartoes", "orcamentos", "metas", "investimentos", "categorias", "recorrencias", "configuracoes"];
let assets = 0;
for (const route of routes) {
  const file = join("out", route, "index.html");
  assert.ok(existsSync(file), `Página não exportada: ${route || "/"}`);
  const html = readFileSync(file, "utf8");
  assert.ok(!html.includes("NEXT_REDIRECT"), `Redirecionamento de servidor em ${route || "/"}`);
  const urls = [...html.matchAll(/(?:src|href)="(\/[^"?#]*_next\/[^"?#]+)[^"]*"/g)];
  for (const match of urls) {
    assert.ok(match[1].startsWith(`${prefix}/_next/`), `Caminho incorreto de asset em ${route || "/"}`);
    const path = decodeURIComponent(match[1].slice(prefix.length + 1));
    assert.ok(existsSync(join("out", path)), `Asset não exportado: ${path}`);
    assets++;
  }
}
assert.ok(existsSync("out/404.html"), "Página 404 não exportada.");
assert.ok(assets > 0, "Nenhum arquivo CSS/JavaScript foi verificado.");
console.log(`Exportação válida: ${routes.length} rotas, página 404 e ${assets} referências a assets.`);
