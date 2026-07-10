/**
 * Read SE2 localStorage keys from a copied Chrome LevelDB folder.
 * Usage: node scripts/read-se2-localstorage.mjs [path-to-leveldb-copy]
 */
import { ClassicLevel } from 'classic-level';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.argv[2] ??
  join(process.cwd(), '.cache/temp/chrome-ls-export');
const OUT = join(__dirname, '../app/lib/studio/se2FactoryDefaults.json');

const WANT = new Set([
  'se2-studio-session-v1',
  'se2-studio-mixer-v1',
  'dmb_shared_piano_snap_subdiv',
]);

function stripChromeLocalStoragePrefix(s) {
  return s.charCodeAt(0) === 1 ? s.slice(1) : s;
}

const db = new ClassicLevel(dbPath, { createIfMissing: false });
const snapshot = {};

for await (const [key, value] of db.iterator()) {
  const k = Buffer.isBuffer(key) ? key.toString('utf8') : String(key);
  for (const want of WANT) {
    if (k.includes(want)) {
      const raw = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
      snapshot[want] = stripChromeLocalStoragePrefix(raw);
      console.log('found', want, 'len', snapshot[want].length);
    }
  }
}

await db.close();

if (!snapshot['se2-studio-session-v1']) {
  console.error('se2-studio-session-v1 not found in', dbPath);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), localStorage: snapshot }, null, 2),
);
console.log('Wrote', OUT, Object.keys(snapshot));
