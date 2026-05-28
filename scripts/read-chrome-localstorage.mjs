import { ClassicLevel } from 'classic-level';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const dbPath = process.argv[2] ?? join(tmpdir(), 'dmb-ls-export');
const OUT = join(process.cwd(), 'app/lib/creationStation/beatLabFactoryDefaults.json');

const WANT = new Set([
  'creationStation_banks',
  'creationStation_patternSlots',
  'creationStation_padSamples_v1',
  'beatLab_tileGrid_v1',
  'dmb_shared_piano_snap_subdiv',
  'beatLab_savedKits_v1',
]);

const db = new ClassicLevel(dbPath, { createIfMissing: false });
const snapshot = {};

for await (const [key, value] of db.iterator()) {
  const k = Buffer.isBuffer(key) ? key.toString('utf8') : String(key);
  for (const want of WANT) {
    if (k.includes(want)) {
      const v = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
      snapshot[want] = v;
      console.log('found', want, 'len', v.length);
    }
  }
}

await db.close();

if (!snapshot.creationStation_banks) {
  console.error('creationStation_banks not found in', dbPath);
  process.exit(1);
}

writeFileSync(
  OUT,
  JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), localStorage: snapshot }, null, 2),
);
console.log('Wrote', OUT);
