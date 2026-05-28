/**
 * Sync trap drum kit → public/samples/sound-families/trap-kit + catalog.json
 *
 * Usage:
 *   node scripts/build-sound-families.mjs
 *   node scripts/build-sound-families.mjs "E:\path\to\inner drumkit folder"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_SOURCE = path.join(ROOT, '.cache', 'trap-drumkit-import');

const DEST_ROOT = path.join(ROOT, 'public', 'samples', 'sound-families', 'trap-kit');
const CATALOG_PATH = path.join(ROOT, 'public', 'samples', 'sound-families', 'catalog.json');

const STRIP_BRAND = /\b(lex|luger|lexluger|dj\s*mustard|metro|boomin|808\s*mafia|trapaholics)\b/gi;
const STRIP_BRAND_INLINE = /lex\s*luger/gi;

/** Source folder name → sound family id (Beat Lab UI). */
const FOLDER_TO_FAMILY = {
  '808s': { id: '808-sub', label: '808 / Sub', defaultPad: 15, order: 0 },
  kicks: { id: 'kick', label: 'Kick', defaultPad: 0, order: 1 },
  snares: { id: 'snare', label: 'Snare', defaultPad: 1, order: 2 },
  claps: { id: 'clap', label: 'Clap', defaultPad: 2, order: 3 },
  'closed hats': { id: 'hihat', label: 'Hi-Hat', defaultPad: 3, order: 4 },
  'open hats': { id: 'open-hat', label: 'Open Hat', defaultPad: 4, order: 5 },
  hits: { id: 'perc', label: 'Perc / Hits', defaultPad: 8, order: 6 },
  percs: { id: 'perc2', label: 'Perc 2', defaultPad: 9, order: 7 },
  'crashes & cymbals': { id: 'cymbal', label: 'Crash / Cymbal', defaultPad: 10, order: 8 },
  fx: { id: 'fx', label: 'Riser / FX', defaultPad: 12, order: 9 },
  extras: { id: 'extra', label: 'Extra', defaultPad: 13, order: 10 },
  vox: { id: 'vox', label: 'Vox', defaultPad: 14, order: 11 },
  tags: { id: 'tag', label: 'Tag', defaultPad: 14, order: 12 },
};

function safeFileName(name) {
  let base = name.replace(/\.[^.]+$/i, '').replace(STRIP_BRAND, '').trim();
  base = base.replace(/[^\w\s.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) base = 'sample';
  return base.slice(0, 80).replace(/\s/g, '-').toLowerCase();
}

const FAMILY_PREFIX = {
  '808-sub': '808',
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  hihat: 'Hi-Hat',
  'open-hat': 'Open Hat',
  perc: 'Perc',
  perc2: 'Perc',
  cymbal: 'Cymbal',
  fx: 'FX',
  extra: 'Extra',
  vox: 'Vox',
  tag: 'Tag',
};

function numberedTitle(familyId, index) {
  const prefix = FAMILY_PREFIX[familyId] ?? 'Sound';
  return `${prefix} ${String(index + 1).padStart(3, '0')}`;
}

function normFolder(name) {
  return name.toLowerCase().trim();
}

function rebuildCatalogFromDest() {
  const familyMap = new Map();
  for (const entry of Object.values(FOLDER_TO_FAMILY)) {
    const destDir = path.join(DEST_ROOT, entry.id);
    if (!fs.existsSync(destDir)) continue;
    const wavs = fs
      .readdirSync(destDir)
      .filter((f) => /\.wav$/i.test(f))
      .sort((a, b) => a.localeCompare(b));
    const samples = wavs.map((wav, i) => ({
      file: `trap-kit/${entry.id}/${wav}`,
      title: numberedTitle(entry.id, i),
    }));
    familyMap.set(entry.id, { ...entry, samples });
  }
  return [...familyMap.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ id, label, defaultPad, samples }) => ({ id, label, defaultPad, samples }));
}

function writeCatalog(families, copied = 0) {
  const catalog = {
    id: 'dmb-builtin-trap',
    title: 'Built-in Trap Kit',
    subtitle: '808s · claps · kicks · hats — always in the app',
    bankIndex: 1,
    families,
    builtAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Copied ${copied} WAVs → ${DEST_ROOT}`);
  console.log(`Catalog → ${CATALOG_PATH}`);
  console.log(
    'Families:',
    families.map((f) => `${f.label} (${f.samples.length})`).join(', '),
  );
}

function main() {
  if (process.argv.includes('--catalog-only')) {
    const families = rebuildCatalogFromDest();
    if (!families.length) {
      console.error('No families in', DEST_ROOT);
      process.exit(1);
    }
    writeCatalog(families, 0);
    return;
  }

  const sourceArg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
  const source = sourceArg ? path.resolve(sourceArg) : DEFAULT_SOURCE;
  if (!fs.existsSync(source)) {
    console.error('Source kit folder not found:', source);
    console.error('Pass the inner drumkit path as argv[1], or use --catalog-only to refresh catalog.json.');
    process.exit(1);
  }

  fs.mkdirSync(DEST_ROOT, { recursive: true });

  const familyMap = new Map();

  const topDirs = fs.readdirSync(source, { withFileTypes: true }).filter((d) => d.isDirectory());
  let copied = 0;

  for (const dir of topDirs) {
    const folderKey = normFolder(dir.name);
    const meta = FOLDER_TO_FAMILY[folderKey];
    if (!meta) continue;

    const srcDir = path.join(source, dir.name);
    const destDir = path.join(DEST_ROOT, meta.id);
    fs.mkdirSync(destDir, { recursive: true });

    const wavs = fs.readdirSync(srcDir).filter((f) => /\.wav$/i.test(f)).sort((a, b) => a.localeCompare(b));
    const samples = familyMap.get(meta.id) ?? { ...meta, samples: [] };
    let sampleIndex = samples.samples.length;

    for (const wav of wavs) {
      const src = path.join(srcDir, wav);
      let destName = `${safeFileName(wav)}.wav`;
      let dest = path.join(destDir, destName);
      let n = 1;
      while (fs.existsSync(dest)) {
        const tryName = `${safeFileName(wav)}-${n}.wav`;
        const tryPath = path.join(destDir, tryName);
        if (fs.existsSync(tryPath) && fs.statSync(tryPath).size === fs.statSync(src).size) {
          destName = tryName;
          dest = tryPath;
          break;
        }
        destName = tryName;
        dest = tryPath;
        n++;
      }
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        copied++;
      }
      samples.samples.push({
        file: `trap-kit/${meta.id}/${destName}`,
        title: numberedTitle(meta.id, sampleIndex),
      });
      sampleIndex++;
    }

    familyMap.set(meta.id, samples);
  }

  const families = [...familyMap.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ id, label, defaultPad, samples }) => ({
      id,
      label,
      defaultPad,
      samples: samples.sort((a, b) => a.title.localeCompare(b.title)),
    }));

  writeCatalog(families, copied);
}

main();
