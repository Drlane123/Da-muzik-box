/**
 * Sound Library & Drum Pack Management
 * Supports loading individual sounds and entire drum packs into pads
 */

export const SOUND_LIBRARY_KEY = 'soundLibrary_v1';
export const DRUM_PACKS_KEY = 'drumPacks_v1';

export type Sound = {
  id: string;
  name: string;
  mime: string;
  data: string; // base64
};

export type SoundLibrary = Record<string, Sound>;

export type DrumPack = {
  id: string;
  name: string;
  description?: string;
  sounds: Sound[]; // Maps to pads 0-15 in order
  createdAt: number;
};

export type DrumPacks = Record<string, DrumPack>;

// ═══════════════════════════════════════════════════════════════════════════
// Sound Library (Individual Sounds)
// ═══════════════════════════════════════════════════════════════════════════

export function loadSoundLibrary(): SoundLibrary {
  try {
    const raw = localStorage.getItem(SOUND_LIBRARY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SoundLibrary;
  } catch {
    return {};
  }
}

export function saveSoundLibrary(library: SoundLibrary): void {
  try {
    localStorage.setItem(SOUND_LIBRARY_KEY, JSON.stringify(library));
  } catch {
    /* quota / private mode */
  }
}

export async function addSoundToLibrary(name: string, file: File): Promise<Sound> {
  const id = `sound_${Date.now()}`;
  const data = await fileToBase64(file);
  const sound: Sound = {
    id,
    name,
    mime: file.type || 'application/octet-stream',
    data,
  };
  
  const library = loadSoundLibrary();
  library[id] = sound;
  saveSoundLibrary(library);
  
  return sound;
}

export function removeSoundFromLibrary(soundId: string): void {
  const library = loadSoundLibrary();
  delete library[soundId];
  saveSoundLibrary(library);
}

// ═══════════════════════════════════════════════════════════════════════════
// Drum Packs (Batch Loading)
// ═══════════════════════════════════════════════════════════════════════════

export function loadDrumPacks(): DrumPacks {
  try {
    const raw = localStorage.getItem(DRUM_PACKS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DrumPacks;
  } catch {
    return {};
  }
}

export function saveDrumPacks(packs: DrumPacks): void {
  try {
    localStorage.setItem(DRUM_PACKS_KEY, JSON.stringify(packs));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Create a drum pack from a folder of sounds
 * Loads sounds in alphabetical order into pads 0-15
 */
export async function createDrumPack(
  packName: string,
  files: File[],
  description?: string
): Promise<DrumPack> {
  const id = `pack_${Date.now()}`;
  
  // Sort files alphabetically
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));
  
  // Limit to 17 sounds (16 pads + 1 sub pad)
  const sounds: Sound[] = [];
  for (let i = 0; i < Math.min(sortedFiles.length, 17); i++) {
    const file = sortedFiles[i];
    const data = await fileToBase64(file);
    sounds.push({
      id: `${id}_${i}`,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      mime: file.type || 'application/octet-stream',
      data,
    });
  }
  
  const pack: DrumPack = {
    id,
    name: packName,
    description,
    sounds,
    createdAt: Date.now(),
  };
  
  const packs = loadDrumPacks();
  packs[id] = pack;
  saveDrumPacks(packs);
  
  return pack;
}

export function removeDrumPack(packId: string): void {
  const packs = loadDrumPacks();
  delete packs[packId];
  saveDrumPacks(packs);
}

/**
 * Get all available packs as a list
 */
export function getPacksList(): DrumPack[] {
  const packs = loadDrumPacks();
  return Object.values(packs).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get all available sounds as a list
 */
export function getSoundsList(): Sound[] {
  const library = loadSoundLibrary();
  return Object.values(library);
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read failed'));
        return;
      }
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsDataURL(file);
  });
}

export function soundToStoredPadSample(sound: Sound) {
  return {
    mime: sound.mime,
    data: sound.data,
  };
}
