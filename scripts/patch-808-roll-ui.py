import re
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "app/screens/EightZeroEightTab.tsx"
s = path.read_text(encoding="utf-8")

s = re.sub(
    r"          \{!!sync\?\.blocks\?\.length && rootChordLabel && \(\n.*?\n          \)\}\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

s = re.sub(
    r"          \{!sync\?\.blocks\?\.length && \(\n.*?\n          \)\}\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

s = re.sub(
    r"          \{hasRollTweaks && \(\n.*?\n          \)\}\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

s = re.sub(
    r"          <motion.div style=\{\{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', flexShrink: 0, padding: '6px 6px 0' \}\}>.*?\{displayRows\.length > 0 && \(\n.*?\n          \)\}\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

# Also try without motion.div
s = re.sub(
    r"          <div style=\{\{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', flexShrink: 0, padding: '6px 6px 0' \}\}>.*?\{displayRows\.length > 0 && \(\n.*?\n          \)\}\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

s = s.replace(
    "padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1",
    "flex: 1, display: 'flex', flexDirection: 'column', padding: '2px 4px'",
    1,
)

s = s.replace(
    "{rollKeyCount}-key keyboard · low bottom / high top · MIDI {rollMinMidi}–{rollMaxMidi} (C-root)",
    "{rollKeyCount} keys · {rollMinMidi}–{rollMaxMidi}",
    1,
)

# Remove duplicate nested roll container if we now have two flex:1 boxes in a row
s = s.replace(
    "borderRadius: 10, border: '1px solid #2a2a32'",
    "borderRadius: 8, border: '1px solid #2a2a32'",
    1,
)

path.write_text(s, encoding="utf-8", newline="\n")
print("patched", path)
