import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { listAvailableCompanies } = await import(
  pathToFileURL(resolve(root, "src/lib/load-analysis.ts")).href
);
const ids = await listAvailableCompanies();
console.log("최근 본 순서:", ids);
