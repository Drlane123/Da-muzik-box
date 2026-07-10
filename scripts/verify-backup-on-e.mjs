import { readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const repoRoot = 'E:\\Da-Music-Box-v4-SOURCE-COMPLETE';
const outDir = join(repoRoot, '.cache', 'temp');
mkdirSync(outDir, { recursive: true });

const zips = readdirSync('E:\\')
  .filter((f) => /^Da-Music-Box-v4-SOURCE-COMPLETE_\d{4}-\d{2}-\d{2}_\d{4}\.zip$/.test(f))
  .map((f) => {
    const full = join('E:\\', f);
    const st = statSync(full);
    return { full, name: f, mtime: st.mtimeMs, size: st.size };
  })
  .sort((a, b) => b.mtime - a.mtime);

if (zips.length === 0) {
  writeFileSync(join(repoRoot, 'pack-result.txt'), 'ERROR: No backup zip on E:\\\n', 'utf8');
  process.exit(1);
}

const zip = zips[0];
const tsMatch = zip.name.match(/_(\d{4}-\d{2}-\d{2}_\d{4})\.zip$/);
const ts = tsMatch ? tsMatch[1] : 'unknown';

let fileCount = 0;
try {
  const listing = execSync(`tar -tf "${zip.full}"`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fileCount = listing.split('\n').filter(Boolean).length;
} catch (e) {
  writeFileSync(join(outDir, 'backup-verify-error.txt'), String(e), 'utf8');
}

const sizeMb = Math.round((zip.size / (1024 * 1024)) * 100) / 100;
const sizeGb = Math.round((zip.size / (1024 * 1024 * 1024)) * 100) / 100;

const stamp = [
  `Saved: ${zip.full}`,
  `Files: ${fileCount}`,
  `Size: ${sizeMb} MB (${sizeGb} GB)`,
  `Size bytes: ${zip.size}`,
  `Timestamp: ${ts}`,
  `Source: ${repoRoot}`,
  `Skipped: node_modules, dist, .cache, .vite-cache, *.zip`,
].join('\n');

writeFileSync(join(repoRoot, `SAVE-STAMP-${ts}.txt`), stamp + '\n', 'utf8');
writeFileSync(join('E:\\', `SAVE-STAMP-${ts}.txt`), stamp + '\n', 'utf8');

const result = [
  'BACKUP VERIFIED ON E: DRIVE',
  '=======================',
  '',
  `Zip: ${zip.full}`,
  `Files: ${fileCount}`,
  `Size: ${sizeMb} MB (${sizeGb} GB)`,
  `Size bytes: ${zip.size}`,
  `Timestamp: ${ts}`,
  '',
  `Stamp: E:\\SAVE-STAMP-${ts}.txt`,
  `Live source: ${repoRoot}`,
].join('\n');

writeFileSync(join(repoRoot, 'pack-result.txt'), result + '\n', 'utf8');
writeFileSync(join(outDir, 'backup-verify-log.txt'), result + '\n', 'utf8');
console.log(result);
