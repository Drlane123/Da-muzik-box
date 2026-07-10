Place renamed guitar DI samples here using strict names:

  string_1_fret_0.wav  (high e open, E4)
  string_2_fret_0.wav  (B3 open)
  ...
  string_6_fret_0.wav  (low E open, E2)
  string_6_fret_12.wav (octave on A-string path example — see string map)

Run the batch renamer from repo root:

  python native/guitar-vst/scripts/rename_guitar_samples.py --scan path/to/raw/wavs
  python native/guitar-vst/scripts/rename_guitar_samples.py --scan path/to/raw/wavs --apply --out native/guitar-vst/assets/samples

Coordinator index → filename string number:
  matrix[0][fret] ← string_6_fret_N.wav (low E)
  matrix[5][fret] ← string_1_fret_N.wav (high e)
