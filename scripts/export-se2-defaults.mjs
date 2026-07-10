/**
 * One-shot: read Studio Editor 2 localStorage from the default Chrome profile and write
 * app/lib/studio/se2FactoryDefaults.json
 *
 * Open SE2 in Chrome on localhost first so session + mixer are saved.
 * Close Chrome first if the profile is locked.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../app/lib/studio/se2FactoryDefaults.json');
const URL = process.env.DMB_EXPORT_URL ?? 'http://localhost:5173/';
const PROFILE =
  process.env.DMB_CHROME_PROFILE ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'User Data');

const KEYS = [
  'se2-studio-session-v1',
  'se2-studio-mixer-v1',
  'dmb_shared_piano_snap_subdiv',
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

  const hasSession = Boolean(snapshot['se2-studio-session-v1']);
  if (!hasSession) {
    console.error(
      'No se2-studio-session-v1 in localStorage — open Studio Editor 2 in Chrome on',
      URL,
      'first, then try again.',
    );
    process.exit(1);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), localStorage: snapshot }, null, 2),
  );
  console.log('Wrote', OUT, Object.keys(snapshot));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
