import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const path = join(dirname(fileURLToPath(import.meta.url)), '../app/screens/EightZeroEightTab.tsx');
const lines = readFileSync(path, 'utf8').split('\n');

const i0 = lines.findIndex((l) => l.includes('Follow lab BPM'));
if (i0 < 0) throw new Error('bpm not found');
let iStart = i0;
while (iStart > 0 && !lines[iStart].includes('gap: 8')) iStart--;

let iEnd = i0;
while (iEnd < lines.length && !lines[iEnd].includes('ref={rollViewportRef}')) iEnd++;
while (iEnd > iStart && (lines[iEnd - 1].trim() === '' || lines[iEnd - 1].trim() === '</div>')) iEnd--;

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
                </motion.div>`.split('\n').map((l) => l.replace('</motion.div>', '</div>'));

lines.splice(iStart, iEnd - iStart, ...compact);
writeFileSync(path, lines.join('\n'), 'utf8');
console.log('toolbar inserted', iStart, iEnd);
