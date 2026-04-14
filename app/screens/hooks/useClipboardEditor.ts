import { useState, useCallback } from 'react';

/** Snapshot for Studio Editor timeline clips: bar/len (bars), label, source track row index. */
export interface ClipboardClipEntry {
  id: string | number;
  trackIndex: number;
  bar: number;
  len: number;
  label: string;
  /** Carried for playable Studio audio clips (same buffer reference). */
  audioBuffer?: AudioBuffer;
}

export interface ClipboardData {
  clips: ClipboardClipEntry[];
  timestamp: number;
}

function findTrackIndexForClip(clip: { id: string | number }, tracks: { clips: { id: string | number }[] }[]): number {
  const sid = String(clip.id);
  const idx = tracks.findIndex((t) => t.clips.some((c) => String(c.id) === sid));
  return idx >= 0 ? idx : 0;
}

/** Map a timeline clip + tracks array into a clipboard entry (Studio uses bar/len/label). */
function toClipboardEntry(clip: any, tracks: any[]): ClipboardClipEntry {
  const entry: ClipboardClipEntry = {
    id: clip.id,
    trackIndex: typeof clip.trackIndex === 'number' ? clip.trackIndex : findTrackIndexForClip(clip, tracks),
    bar: typeof clip.bar === 'number' ? clip.bar : typeof clip.startTime === 'number' ? clip.startTime : 1,
    len: typeof clip.len === 'number' ? clip.len : typeof clip.duration === 'number' ? clip.duration : 1,
    label: typeof clip.label === 'string' ? clip.label : 'Clip',
  };
  if (clip.audioBuffer instanceof AudioBuffer) {
    entry.audioBuffer = clip.audioBuffer;
  }
  return entry;
}

let _pasteClipId = 900000;
function allocPasteClipId(): number {
  _pasteClipId += 1;
  return _pasteClipId;
}

export const useClipboardEditor = () => {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);

  // CUT: Remove clips and copy to clipboard
  const cut = useCallback((clips: any[], tracks: any[]) => {
    if (clips.length === 0) return { tracks, copiedClips: clips };

    setClipboard({
      clips: clips.map((c) => toClipboardEntry(c, tracks)),
      timestamp: Date.now(),
    });

    const idSet = new Set(clips.map((c) => String(c.id)));
    const newTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c: any) => !idSet.has(String(c.id))),
    }));

    return { tracks: newTracks, copiedClips: clips };
  }, []);

  // COPY: Copy clips to clipboard without removing
  const copy = useCallback((clips: any[], tracks: any[]) => {
    if (clips.length === 0) return;

    setClipboard({
      clips: clips.map((c) => toClipboardEntry(c, tracks)),
      timestamp: Date.now(),
    });
  }, []);

  // PASTE: Paste at playhead bar (1-based, matches Studio clip.bar + Math.round(playheadPos))
  const paste = useCallback((tracks: any[], pasteAtBar: number, onTrackIndex?: number) => {
    if (!clipboard || clipboard.clips.length === 0) return tracks;

    const anchorBar = clipboard.clips[0].bar;
    const barDiff = (Math.max(1, Math.round(pasteAtBar) || 1)) - anchorBar;

    const newTracks = tracks.map((t) => ({ ...t, clips: [...t.clips] }));

    clipboard.clips.forEach((entry) => {
      const trackIdx = onTrackIndex !== undefined ? onTrackIndex : entry.trackIndex;
      if (trackIdx < 0 || !newTracks[trackIdx]) return;

      const newBar = Math.max(1, Math.round(entry.bar + barDiff));
      const pasted = {
        id: allocPasteClipId(),
        bar: newBar,
        len: Math.max(1, entry.len),
        label: entry.label,
        ...(entry.audioBuffer ? { audioBuffer: entry.audioBuffer } : {}),
      };

      newTracks[trackIdx] = {
        ...newTracks[trackIdx],
        clips: [...newTracks[trackIdx].clips, pasted],
      };
    });

    return newTracks;
  }, [clipboard]);

  // DUPLICATE: Create copy immediately after the last clip on that track (bar + len layout)
  const duplicate = useCallback((tracks: any[], clips: any[]) => {
    if (clips.length === 0) return tracks;

    const newTracks = tracks.map((t) => ({ ...t, clips: [...t.clips] }));

    clips.forEach((clip) => {
      const trackIndex = typeof clip.trackIndex === 'number' ? clip.trackIndex : findTrackIndexForClip(clip, tracks);
      const track = newTracks[trackIndex];
      if (!track) return;

      const len = typeof clip.len === 'number' ? clip.len : typeof clip.duration === 'number' ? clip.duration : 1;
      const label = typeof clip.label === 'string' ? clip.label : 'Clip';

      const nextStart =
        track.clips.length > 0
          ? Math.max(...track.clips.map((c: any) => (typeof c.bar === 'number' ? c.bar : 1) + (typeof c.len === 'number' ? c.len : 1)))
          : 1;

      newTracks[trackIndex] = {
        ...track,
        clips: [
          ...track.clips,
          {
            id: allocPasteClipId(),
            bar: Math.max(1, nextStart),
            len: Math.max(1, len),
            label,
            ...(clip.audioBuffer ? { audioBuffer: clip.audioBuffer } : {}),
          },
        ],
      };
    });

    return newTracks;
  }, []);

  // DELETE: Remove clips from timeline (selection ids are strings)
  const deleteClips = useCallback((tracks: any[], clipIds: string[]) => {
    const idSet = new Set(clipIds.map(String));
    return tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c: any) => !idSet.has(String(c.id))),
    }));
  }, []);

  // SPLIT AT TIME: Slice a clip into two pieces (bar-based if clip uses bar/len)
  const splitClip = useCallback((tracks: any[], clipId: string, splitTime: number) => {
    return tracks.map((track) => ({
      ...track,
      clips: track.clips.flatMap((c: any) => {
        if (String(c.id) !== String(clipId)) return [c];

        const bar = typeof c.bar === 'number' ? c.bar : c.startTime;
        const len = typeof c.len === 'number' ? c.len : c.duration;
        if (typeof bar !== 'number' || typeof len !== 'number') return [c];

        const splitBar = Math.round(splitTime);
        if (splitBar <= bar || splitBar >= bar + len) return [c];

        const splitPoint = splitBar - bar;
        return [
          { ...c, len: splitPoint },
          {
            ...c,
            id: allocPasteClipId(),
            bar: splitBar,
            len: len - splitPoint,
          },
        ];
      }),
    }));
  }, []);

  return {
    clipboard,
    selectedClips,
    setSelectedClips,
    cut,
    copy,
    paste,
    duplicate,
    deleteClips,
    splitClip,
  };
};
