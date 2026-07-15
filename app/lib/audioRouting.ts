/**
 * Browser-real audio routing helpers (no fake native driver UIs).
 * Input: MediaDevices.getUserMedia + deviceId constraints.
 * Output: AudioContext.setSinkId when supported (Chromium); else system default.
 */

export type MediaDeviceOption = {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
};

function hasAudioOutputPicker(): boolean {
  if (typeof AudioContext === 'undefined') return false;
  return typeof (AudioContext.prototype as unknown as { setSinkId?: unknown })
    .setSinkId === 'function';
}

export function getAudioOutputSupport(): 'setSinkId' | 'none' {
  return hasAudioOutputPicker() ? 'setSinkId' : 'none';
}

/** Enumerate devices; labels may be empty until getUserMedia has been granted for that kind. */
export async function enumerateAudioDevices(): Promise<{
  inputs: MediaDeviceOption[];
  outputs: MediaDeviceOption[];
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }
  const list = await navigator.mediaDevices.enumerateDevices();
  const inputs: MediaDeviceOption[] = [];
  const outputs: MediaDeviceOption[] = [];
  for (const d of list) {
    const label =
      d.label?.trim() ||
      (d.kind === 'audioinput'
        ? `Microphone ${d.deviceId.slice(0, 8)}…`
        : d.kind === 'audiooutput'
          ? `Speaker ${d.deviceId.slice(0, 8)}…`
          : d.deviceId);
    const opt = { deviceId: d.deviceId, label, kind: d.kind };
    if (d.kind === 'audioinput') inputs.push(opt);
    else if (d.kind === 'audiooutput') outputs.push(opt);
  }
  return { inputs, outputs };
}

/** Build getUserMedia audio constraint from stored setting. */
export function audioInputConstraint(
  audioInputDeviceId: string,
): boolean | MediaTrackConstraints {
  if (!audioInputDeviceId || audioInputDeviceId === 'default') {
    return true;
  }
  return { deviceId: { exact: audioInputDeviceId } };
}

/** Full `audio` constraint for DAW record / mic check (device from settings + processing). */
export function studioMicTrackConstraints(audioInputDeviceId: string): MediaTrackConstraints {
  const base = audioInputConstraint(audioInputDeviceId);
  // Echo cancel + NS on — SE2 software-monitors through the same output; without these,
  // speakers → mic forms a feedback loop the moment Record arms the strip.
  if (typeof base === 'boolean') {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      channelCount: 1,
    };
  }
  return {
    ...base,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    channelCount: 1,
  };
}

/**
 * Route Web Audio master graph to a physical output when the browser supports setSinkId.
 * Uses default system output when sinkId is missing or 'default'.
 */
export async function applyAudioOutputSink(
  ctx: AudioContext,
  sinkId: string,
): Promise<void> {
  const setSinkId = (
    ctx as unknown as { setSinkId?: (id: string) => Promise<void> }
  ).setSinkId;
  if (typeof setSinkId !== 'function') return;
  try {
    if (!sinkId || sinkId === 'default') {
      await setSinkId.call(ctx, '');
      return;
    }
    await setSinkId.call(ctx, sinkId);
  } catch (e) {
    console.warn('[audioRouting] setSinkId failed, using browser default:', e);
  }
}
