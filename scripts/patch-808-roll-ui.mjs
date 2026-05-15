import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const path = join(dirname(fileURLToPath(import.meta.url)), '../app/screens/EightZeroEightTab.tsx');
const lines = readFileSync(path, 'utf8').split('\n');

function findLine(pred) {
  const i = lines.findIndex(pred);
  if (i < 0) throw new Error('line not found: ' + pred);
  return i;
}

// Remove chord banner: line with rootChordLabel && (
let i0 = lines.findIndex((l) => l.includes('!!sync?.blocks?.length && rootChordLabel'));
if (i0 >= 0) {
  let i1 = i0;
  while (i1 < lines.length && !lines[i1].includes('          )}')) i1++;
  lines.splice(i0, i1 - i0 + 1);
}

// Remove no sync message
let i2 = lines.findIndex((l) => l.includes('!sync?.blocks?.length && ('));
if (i2 >= 0) {
  let i3 = i2;
  while (i3 < lines.length && !lines[i3].includes('          )}')) i3++;
  lines.splice(i2, i3 - i2 + 1);
}

// Remove external reset
let i4 = lines.findIndex((l) => l.includes('{hasRollTweaks && ('));
if (i4 >= 0) {
  let i5 = i4;
  while (i5 < lines.length && !lines[i5].includes('Reset roll')) i5++;
  while (i5 < lines.length && !lines[i5].includes('          )}')) i5++;
  lines.splice(i4, i5 - i4 + 1);
}

// Remove bottom panel: SOUND LANE through displayRows table
let i6 = lines.findIndex((l) => l.includes("SOUND LANE") && l.includes('fontSize: 10'));
if (i6 < 0) i6 = lines.findIndex((l) => l.trim() === '<span style={{ fontSize: 10, fontWeight: 800, color: \'#71717a\' }}>SOUND LANE</span>');
if (i6 >= 0) {
  // back up to opening div of bottom panel
  let start = i6;
  while (start > 0 && !lines[start].includes("padding: '6px 6px 0'")) start--;
  let i7 = start;
  while (i7 < lines.length && !lines[i7].includes('{displayRows.length > 0')) i7++;
  if (i7 < lines.length) {
    while (i7 < lines.length && !lines[i7].includes('          )}')) i7++;
    lines.splice(start, i7 - start + 1);
  } else {
    // no display rows - remove until closing div before drum machine
    while (i7 < lines.length && !lines[i7].includes('labPanel === \'drum-machine\'')) i7++;
    let end = i7 - 1;
    while (end > start && lines[end].trim() !== '</motion.div>' && lines[end].trim() !== '</div>') end--;
    lines.splice(start, end - start + 1);
  }
}

let s = lines.join('\n');

// Fix duplicate overflow
s = s.replace("overflow: 'hidden', minHeight: 0, minWidth: 0, overflow: 'hidden'", "minHeight: 0, minWidth: 0, overflow: 'hidden'");

// Compact toolbar row 2 - insert after BPM row closes (before rollViewportRef)
const compact = `                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, width: '100%' }}>
                  <button type="button" onClick={() => setSoundLane('kick')} style={{ ...btnMini, padding: '2px 6px', fontSize: 8, borderColor: soundLane === 'kick' ? '#ca8a04' : '#52525b', background: soundLane === 'kick' ? '#422006' : '#27272f', color: soundLane === 'kick' ? '#fde68a' : '#a1a1aa' }}>Kick</button>
                  <button type="button" onClick={() => setSoundLane('bass')} style={{ ...btnMini, padding: '2px 6px', fontSize: 8, borderColor: soundLane === 'bass' ? '#22c55e' : '#52525b', background: soundLane === 'bass' ? '#052e16' : '#27272f', color: soundLane === 'bass' ? '#86efac' : '#a1a1aa' }}>Bass</button>
                  <select
                    value={soundLane === 'kick' ? trapKickPresetId : bassPresetId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (soundLane === 'kick') setTrapKickPresetId(v as TrapHold808PresetId);
                      else setBassPresetId(v as BassLowBassPresetId);
                    }}
                    style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #3f3f46', background: '#12121a', color: '#e4e4e7', fontSize: 8, fontWeight: 800, maxWidth: 128 }}
                  >
                    {soundLane === 'kick'
                      ? TRAP_HOLD_808_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {TRAP_HOLD_808_PRESETS[id].label}
                          </option>
                        ))
                      : BASS_LOW_BASS_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {BASS_LOW_BASS_PRESETS[id].label}
                          </option>
                        ))}
                  </select>
                  <input type="range" min={0.35} max={1} step={0.02} value={velocity} onChange={(e) => setVelocity(+e.target.value)} title="Level" style={{ width: 52, accentColor: '#ca8a04' }} />
                  <span style={{ fontSize: 8, color: '#52525b' }}>HP</span>
                  <input type="range" min={0} max={8000} step={10} value={lab808HpHz < 25 ? 0 : lab808HpHz} onChange={(e) => { const v = +e.target.value; setLab808HpHz(v < 25 ? 0 : v); }} style={{ width: 44, accentColor: '#7cf4c6' }} />
                  <span style={{ fontSize: 8, color: '#52525b' }}>LP</span>
                  <input type="range" min={200} max={20000} step={50} value={lab808LpHz >= 200 && lab808LpHz < 19900 ? lab808LpHz : 20000} onChange={(e) => { const v = +e.target.value; setLab808LpHz(v >= 19900 ? 0 : v); }} style={{ width: 44, accentColor: '#7cf4c6' }} />
                  {hasRollTweaks && (
                    <button
                      type="button"
                      onClick={() => {
                        setRollPitchOverride({});
                        setManualRollNotes([]);
                        setRollKeyboardBaseMidi(LAB808_KICK_ROLL_BASE_MIDI);
                        setNoteDurBeats(() => {
                          const next: Record<number, number> = {};
                          for (let i = 0; i < rollData.length; i++) next[i] = DEFAULT_NOTE_BEATS;
                          return next;
                        });
                        setNoteStartShiftBeats(() => {
                          const next: Record<number, number> = {};
                          for (let i = 0; i < rollData.length; i++) next[i] = 0;
                          return next;
                        });
                      }}
                      style={{ ...btnMini, padding: '2px 6px', fontSize: 8 }}
                    >
                      Reset
                    </button>
                  )}
                </div>`;

if (!s.includes("onClick={() => setSoundLane('kick')}")) {
  s = s.replace(
    '              </div>\n              <div\n                ref={rollViewportRef}',
    `              </motion.div>\n${compact}\n              <div\n                ref={rollViewportRef}`,
  );
}

// Shrink header - remove BPM row to save space (optional) - user wanted big roll, remove follow lab bpm row
s = s.replace(
  /                <div style=\{\{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 \}\}>\n                  <label style=\{\{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10[\s\S]*?                  <\/label>\n                <\/div>\n/,
  '',
);

writeFileSync(path, s, 'utf8');
console.log('done');
