import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Combinações usadas pelos filtros opcionais do histórico, sem alterar documentos existentes.
export function historyIndexes() {
  const indexes = new Map();
  const asc = fieldPath => ({ fieldPath, order: "ASCENDING" });
  const desc = fieldPath => ({ fieldPath, order: "DESCENDING" });
  const add = fields => indexes.set(JSON.stringify(fields), { collectionGroup: "entries", queryScope: "COLLECTION", fields });
  for (const invoice of [false, true]) for (const category of [false, true]) for (const account of [null, "accountId", "toAccountId"]) {
    if (invoice && account || category && account === "toAccountId") continue;
    const prefix = [asc("kind"), ...(invoice ? [asc("invoiceMonth")] : []), ...(category ? [asc("categoryId")] : []), ...(account ? [asc(account)] : [])];
    add([...prefix, asc("date")]);
    add([...prefix, desc("date")]);
    add([...prefix, desc("amount"), desc("date")]);
    for (const settled of [false, true]) for (const dates of [false, true]) {
      if (invoice && settled) continue;
      add([...prefix, ...(settled ? [asc("status")] : []), ...(dates ? [asc("date")] : []), asc("amount")]);
    }
  }
  add([asc("kind"), asc("cardId"), asc("amount")]);
  add([asc("kind"), asc("cardId")]);
  add([asc("kind"), asc("cardId"), asc("invoiceMonth"), asc("amount")]);
  add([asc("kind"), asc("cardId"), asc("invoiceMonth")]);
  add([asc("kind"), asc("invoiceMonth")]);
  add([asc("cardId"), asc("invoiceMonth")]);
  add([desc("date"), desc("createdAt")]);
  add([asc("kind"), asc("status")]);
  return [...indexes.values()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const indexes = historyIndexes();
  writeFileSync(new URL("../firestore.indexes.json", import.meta.url), JSON.stringify({ indexes, fieldOverrides: [] }, null, 2) + "\n");
  console.log(`${indexes.length} índices de consultas gerados.`);
}
