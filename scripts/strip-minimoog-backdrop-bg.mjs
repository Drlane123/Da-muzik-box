/**
 * Build groove-lead-backdrop-minimoog-cutout.png — transparent, smooth bottom edge.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const srcPath = join(dir, '..', 'public', 'groove-lead-backdrop-minimoog.png');
const outPath = join(dir, '..', 'public', 'groove-lead-backdrop-minimoog-cutout.png');

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isGlobalBackdrop(r, g, b) {
  if (r >= 225 && g >= 225 && b >= 225) return true;
  const l = lum(r, g, b);
  return l >= 230 && sat(r, g, b) < 32;
}

/** Paper flakes / halos on the wood base — light, low-saturation pixels. */
function isBottomFringe(r, g, b) {
  const l = lum(r, g, b);
  const s = sat(r, g, b);
  if (l >= 200 && s < 50) return true;
  if (l >= 178 && s < 28) return true;
  if (r >= 195 && g >= 195 && b >= 195 && s < 40) return true;
  return false;
}

/** Flood from bottom edge — removes connected paper/halos along the base. */
function floodClearBottomPaper(data, width, height, channels) {
  const minY = Math.max(0, Math.floor(height * 0.9));
  const seen = new Uint8Array(width * height);
  const stack = [];

  const tryPush = (x, y) => {
    if (x < 0 || x >= width || y < minY || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * channels;
    if (data[i + 3] < 12) return;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = lum(r, g, b);
    const s = sat(r, g, b);
    const paper = isBottomFringe(r, g, b) || isGlobalBackdrop(r, g, b) || (l >= 160 && s < 42);
    if (!paper) return;
    seen[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < width; x += 1) tryPush(x, height - 1);

  while (stack.length > 0) {
    const p = stack.pop();
    const y = Math.floor(p / width);
    const x = p % width;
    const i = p * channels;
    data[i + 3] = 0;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
}

function cropBottomFringeRows(data, width, height, channels) {
  let lastGood = height - 1;
  for (let row = height - 1; row >= 0; row -= 1) {
    let opaque = 0;
    let fringe = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (row * width + x) * channels;
      if (data[i + 3] < 16) continue;
      opaque += 1;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isGlobalBackdrop(r, g, b) || isBottomFringe(r, g, b)) fringe += 1;
    }
    if (opaque === 0) {
      lastGood = row - 1;
      continue;
    }
    if (fringe / opaque < 0.55) break;
    lastGood = row - 1;
  }
  return Math.max(1, lastGood + 1);
}

/** Soften jagged alpha along the bottom silhouette. */
/** Crop to real synth pixels — excludes light paper fringe from the bounding box. */
function contentBounds(data, width, height, channels) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i + 3] < 40) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = lum(r, g, b);
      const s = sat(r, g, b);
      if (l >= 145 && s < 48) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) {
    return { left: 0, top: 0, width, height };
  }
  /** Drop bottom rows that are mostly paper/fringe or UI chrome. */
  let trimY = maxY;
  for (let y = maxY; y >= minY; y -= 1) {
    let opaque = 0;
    let fringe = 0;
    for (let x = minX; x <= maxX; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i + 3] < 40) continue;
      opaque += 1;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBottomFringe(r, g, b) || isGlobalBackdrop(r, g, b) || (lum(r, g, b) >= 145 && sat(r, g, b) < 48)) {
        fringe += 1;
      }
    }
    if (opaque === 0 || fringe / opaque < 0.55) {
      trimY = y;
      break;
    }
  }
  maxY = trimY;
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function smoothBottomAlpha(data, width, height, channels, rows = 5) {
  const start = Math.max(0, height - rows);
  for (let row = start; row < height; row += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (row * width + x) * channels;
      let a = data[i + 3];
      if (a === 0) continue;
      let sum = a;
      let n = 1;
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const ni = (row * width + nx) * channels;
        sum += data[ni + 3];
        n += 1;
      }
      if (row > 0) {
        const ui = ((row - 1) * width + x) * channels;
        sum += data[ui + 3];
        n += 1;
      }
      const avg = sum / n;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBottomFringe(r, g, b)) {
        data[i + 3] = 0;
      } else if (avg < 200 && a > 0) {
        data[i + 3] = Math.min(a, Math.round(avg * 0.85));
      }
    }
  }
}

const meta = await sharp(srcPath).metadata();
const w = meta.width ?? 0;
const h = meta.height ?? 0;
const cropTop = Math.round(h * 0.06);
const cropBottom = Math.round(h * 0.11);
const cropH = Math.max(1, h - cropTop - cropBottom);

let { data, info } = await sharp(srcPath)
  .extract({ left: 0, top: cropTop, width: w, height: cropH })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  if (isGlobalBackdrop(data[i], data[i + 1], data[i + 2])) {
    data[i + 3] = 0;
  }
}

const bottomBandStart = Math.max(0, Math.floor(height * 0.82));
for (let row = bottomBandStart; row < height; row += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (row * width + x) * channels;
    if (data[i + 3] < 8) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isBottomFringe(r, g, b)) {
      data[i + 3] = 0;
    }
  }
}

floodClearBottomPaper(data, width, height, channels);
smoothBottomAlpha(data, width, height, channels, 6);

let trimmedH = cropBottomFringeRows(data, width, height, channels);
if (trimmedH < height) {
  data = Buffer.from(data.subarray(0, trimmedH * width * channels));
  height = trimmedH;
}

smoothBottomAlpha(data, width, height, channels, 4);

/** Last rows: strip any light/paper pixel (flakes sit on the wood lip). */
const lipRows = Math.min(8, height);
for (let row = height - lipRows; row < height; row += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (row * width + x) * channels;
    if (data[i + 3] < 8) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = lum(r, g, b);
    const s = sat(r, g, b);
    if (isBottomFringe(r, g, b) || isGlobalBackdrop(r, g, b) || (l >= 148 && s < 44)) {
      data[i + 3] = 0;
    }
  }
}
floodClearBottomPaper(data, width, height, channels);
smoothBottomAlpha(data, width, height, channels, 5);

const bounds = contentBounds(data, width, height, channels);
const cropped = await sharp(data, { raw: { width, height, channels } })
  .extract(bounds)
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log('Wrote', outPath, `${cropped.width}x${cropped.height}`);
