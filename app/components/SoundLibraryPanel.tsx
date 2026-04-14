import React, { useRef, useState, useCallback } from 'react';
import {
  loadSoundLibrary,
  saveSoundLibrary,
  addSoundToLibrary,
  removeSoundFromLibrary,
  getPacksList,
  getSoundsList,
  createDrumPack,
  removeDrumPack,
  soundToStoredPadSample,
} from '../lib/soundLibrary';
import { loadPadSampleStore, savePadSampleStore, padSampleKey } from '../lib/padSampleStorage';

interface SoundLibraryPanelProps {
  onSoundLoaded?: () => void;
}

export function SoundLibraryPanel({ onSoundLoaded }: SoundLibraryPanelProps) {
  const [tab, setTab] = useState<'library' | 'packs'>('library');
  const [sounds, setSounds] = useState(getSoundsList());
  const [packs, setPacks] = useState(getPacksList());
  
  const soundFileInputRef = useRef<HTMLInputElement>(null);
  const packFileInputRef = useRef<HTMLInputElement>(null);
  const packNameInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Individual Sound Loading
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddSound = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      await addSoundToLibrary(file.name.replace(/\.[^/.]+$/, ''), file);
      setSounds(getSoundsList());
      onSoundLoaded?.();
    } catch (err) {
      console.error('Failed to add sound:', err);
      alert('Failed to load sound');
    }
    e.currentTarget.value = '';
  }, [onSoundLoaded]);

  const handleLoadSoundToPad = useCallback(
    (soundId: string, bankIndex: number, padIndex: number) => {
      const sound = getSoundsList().find((s) => s.id === soundId);
      if (!sound) return;

      const store = loadPadSampleStore();
      store[padSampleKey(bankIndex, padIndex)] = soundToStoredPadSample(sound);
      savePadSampleStore(store);
      onSoundLoaded?.();
    },
    [onSoundLoaded]
  );

  const handleDeleteSound = useCallback((soundId: string) => {
    removeSoundFromLibrary(soundId);
    setSounds(getSoundsList());
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Drum Pack Loading
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreatePack = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    const packName = packNameInputRef.current?.value || `Pack ${Date.now()}`;
    try {
      await createDrumPack(packName, Array.from(files));
      setPacks(getPacksList());
      onSoundLoaded?.();
      
      if (packNameInputRef.current) packNameInputRef.current.value = '';
      e.currentTarget.value = '';
    } catch (err) {
      console.error('Failed to create pack:', err);
      alert('Failed to create drum pack');
    }
  }, [onSoundLoaded]);

  const handleLoadPackToPads = useCallback(
    (packId: string, bankIndex: number) => {
      const packsList = getPacksList();
      const pack = packsList.find((p) => p.id === packId);
      if (!pack) return;

      const store = loadPadSampleStore();
      pack.sounds.forEach((sound, padIndex) => {
        store[padSampleKey(bankIndex, padIndex)] = soundToStoredPadSample(sound);
      });
      savePadSampleStore(store);
      onSoundLoaded?.();
      alert(`Loaded ${pack.name} into Bank ${String.fromCharCode(65 + bankIndex)}`);
    },
    [onSoundLoaded]
  );

  const handleDeletePack = useCallback((packId: string) => {
    removeDrumPack(packId);
    setPacks(getPacksList());
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700 text-white">
      <h3 className="text-lg font-bold mb-4">🎵 Sound Manager</h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-700">
        <button
          onClick={() => setTab('library')}
          className={`px-3 py-2 text-sm ${
            tab === 'library'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Individual Sounds
        </button>
        <button
          onClick={() => setTab('packs')}
          className={`px-3 py-2 text-sm ${
            tab === 'packs'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Drum Packs
        </button>
      </div>

      {/* Individual Sounds Tab */}
      {tab === 'library' && (
        <div className="space-y-3">
          <button
            onClick={() => soundFileInputRef.current?.click()}
            className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold transition"
          >
            + Load Sound
          </button>
          <input
            ref={soundFileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAddSound}
            className="hidden"
          />

          {sounds.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No sounds loaded yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sounds.map((sound) => (
                <div
                  key={sound.id}
                  className="bg-gray-800 p-2 rounded flex items-center justify-between"
                >
                  <div className="text-sm truncate flex-1">
                    <p className="font-semibold">{sound.name}</p>
                    <p className="text-xs text-gray-400">{sound.mime}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteSound(sound.id)}
                    className="ml-2 text-red-400 hover:text-red-300 text-xs px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drum Packs Tab */}
      {tab === 'packs' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              ref={packNameInputRef}
              type="text"
              placeholder="Pack name..."
              className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-sm"
            />
            <button
              onClick={() => packFileInputRef.current?.click()}
              className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-semibold transition"
            >
              + Create
            </button>
          </div>
          <input
            ref={packFileInputRef}
            type="file"
            multiple
            accept="audio/*"
            onChange={handleCreatePack}
            className="hidden"
          />

          {packs.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No packs created yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-gray-800 p-2 rounded"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm flex-1">
                      <p className="font-semibold">{pack.name}</p>
                      <p className="text-xs text-gray-400">{pack.sounds.length} sounds</p>
                    </div>
                    <button
                      onClick={() => handleDeletePack(pack.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        💡 Load individual sounds into pads or entire packs into a bank
      </p>
    </div>
  );
}
