import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { run, one } from "./db";
import * as abroad from "../abroad/catalogue";
import * as courses from "../market/courses";

/**
 * Keeps the two catalogues that live in editable JSON files (study-abroad countries and universities, the course catalogue) loaded into the
 * database. A fingerprint of each file is stored in schema_meta, so the load only happens when the file changes (first start, or after an
 * edit). Loading is an upsert, so running it again is harmless.
 */
async function loadIfChanged(key: string, file: string, load: (json: never) => Promise<number>): Promise<string> {
  const full = path.join(process.cwd(), file);
  const raw = fs.readFileSync(full);
  const sig = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  const have = await one<{ v: string }>("SELECT v FROM schema_meta WHERE k = $1", [key]);
  if (have?.v === sig) return "unchanged";
  const n = await load(JSON.parse(raw.toString("utf8")) as never);
  await run("INSERT INTO schema_meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v", [key, sig]);
  return `${n} loaded`;
}

export async function seedCatalogues(): Promise<string[]> {
  const { seedCatalogue: seedPay } = await import("../pay/catalogue");
  return [
    `study abroad: ${await loadIfChanged("abroad_sig_node", "lib/abroad/data/study-abroad.json", abroad.sync)}`,
    `courses: ${await loadIfChanged("courses_sig_node", "lib/market/data/courses.json", courses.sync)}`,
    `payment products added: ${await seedPay()}`,
  ];
}
