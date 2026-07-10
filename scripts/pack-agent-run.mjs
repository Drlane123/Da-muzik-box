import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

const repo = process.cwd();
const lines = [];
const log = (...a) => lines.push(a.join(' '));

function diskGB(drive) {
  try {
    const o = execSync(wmic logicaldisk where "DeviceID=''" get FreeSpace,Size /format:csv, { encoding: 'utf8' });
    const parts = o.trim().split(/\r?\n/).filter(Boolean).pop().split(',');
    const free = Number(parts[1]) / 1e9;
    const total = Number(parts[2]) / 1e9;
    return { free: free.toFixed(2), total: total.toFixed(2) };
  } catch (e) {
    return { err: String(e.message || e) };
  }
}

for (const d of ['C:', 'E:']) {
  const info = diskGB(d);
  log('DISK', d, JSON.stringify(info));
}

function listZips() {
  try {
    return fs.readdirSync('E:\\').filter((n) => n.startsWith('Da-Music-Box') && n.endsWith('.zip')).map((n) => {
      const p = path.join('E:\\', n);
      const st = fs.statSync(p);
      return ${n}  MB ;
    });
  } catch (e) {
    return [err: ];
  }
}

log('ZIPS_ON_E', ...(listZips().length ? listZips() : ['(none)']));

log('RUN_PACK', 'starting');
try {
  const out = execSync(powershell -NoProfile -ExecutionPolicy Bypass -File "", {
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 100 * 1024 * 1024,
  });
  log('PACK_OK', 'exit 0');
  log('PACK_STDOUT_TAIL', out.slice(-6000));
} catch (e) {
  log('PACK_EXIT', e.status);
  if (e.stdout) log('PACK_STDOUT_TAIL', String(e.stdout).slice(-6000));
  if (e.stderr) log('PACK_STDERR', String(e.stderr).slice(-4000));
}

const pr = path.join(repo, 'pack-result.txt');
if (fs.existsSync(pr)) log('PACK_RESULT', fs.readFileSync(pr, 'utf8').trim());

const c = path.join(repo, 'app/lib/creationStation/beatLabPatternPresetKits.ts');
const em = 'E:/Da-Music-Box-v4-SOURCE-COMPLETE/app/lib/creationStation/beatLabPatternPresetKits.ts';
const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

if (fs.existsSync(em)) {
  const cs = fs.readFileSync(c, 'utf8');
  const es = fs.readFileSync(em, 'utf8');
  log('VERIFY_SHA256_MATCH', h(c) === h(em));
  log('C_has_miamiBass808', /miamiBass808/.test(cs));
  log('C_has_Miami_import', /beatLabAfroReggaeMiamiPatterns|Miami/.test(cs));
  log('E_has_miamiBass808', /miamiBass808/.test(es));
  log('E_has_Miami_import', /beatLabAfroReggaeMiamiPatterns|Miami/.test(es));
} else {
  log('VERIFY', 'E mirror file missing:', em);
}

const zips = listZips();
if (zips.length) log('LATEST_ZIP', zips[0]);

function countFiles(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += countFiles(p);
    else if (ent.isFile()) n += 1;
  }
  return n;
}

const mirror = 'E:\\Da-Music-Box-v4-SOURCE-COMPLETE';
if (fs.existsSync(mirror)) log('MIRROR_FILE_COUNT', String(countFiles(mirror)));
else log('MIRROR', 'missing');

const reportPath = path.join(repo, 'pack-agent-report.txt');
fs.writeFileSync(reportPath, lines.join(os.EOL));
console.log(lines.join(os.EOL));
