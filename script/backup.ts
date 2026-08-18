import mongoose from "mongoose";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Nightly backup: dumps every collection to backups/<timestamp>/*.json
// Run in GH Actions (see .github/workflows/nightly-backup.yml), uploads to R2.
// Retains the full history locally on the runner only; R2 keeps 30 days via workflow cleanup.

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join("backups", ts);
  await mkdir(outDir, { recursive: true });

  const manifest: any = { createdAt: new Date().toISOString(), collections: {} };

  for (const c of collections) {
    const name = c.name;
    try {
      const docs = await db.collection(name).find({}).limit(100_000).toArray();
      await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(docs));
      manifest.collections[name] = docs.length;
      console.log(`[backup] ${name}: ${docs.length} docs`);
    } catch (err: any) {
      console.error(`[backup] FAILED ${name}: ${err.message}`);
      manifest.collections[name] = -1;
    }
  }

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[backup] done → ${outDir}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("[backup] fatal:", e);
  process.exit(1);
});