/**
 * One-shot: read Beat Lab localStorage from the default Chrome profile and write
 * app/lib/creationStation/beatLabFactoryDefaults.json
 *
 * Close Chrome first if the profile is locked.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../app/lib/creationStation/beatLabFactoryDefaults.json');
const URL = process.env.DMB_EXPORT_URL ?? 'http://localhost:5173/';
const PROFILE =
  process.env.DMB_CHROME_PROFILE ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'User Data');

const KEYS = [
  'creationStation_banks',
  'creationStation_patternSlots',
  'creationStation_padSamples_v1',
  'beatLab_tileGrid_v1',
  'dmb_shared_piano_snap_subdiv',
  'beatLab_savedKits_v1',
];

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: true,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2000);

  const snapshot = await page.evaluate((keys) => {
    const out = {};
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    }
    return out;
  }, KEYS);

  await context.close();

  const hasBanks = Boolean(snapshot.creationStation_banks);
  if (!hasBanks) {
    console.error('No creationStation_banks in localStorage — open Beat Lab in Chrome on', URL, 'first.');
    process.exit(1);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), localStorage: snapshot }, null, 2));
  console.log('Wrote', OUT, Object.keys(snapshot));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
