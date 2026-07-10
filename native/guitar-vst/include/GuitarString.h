#pragma once

namespace da::guitar
{

/** Physical string state — one active fret maximum (monophonic per string). */
struct GuitarString
{
    int openMidiNote = 0;     // e.g. string 6 (index 0) = 40 (E2)
    int currentFret = -1;     // -1 = open / not fretted
    bool isRinging = false;
    int activeMidiNote = -1;  // MIDI pitch currently held on this string

    void reset() noexcept
    {
        currentFret = -1;
        isRinging = false;
        activeMidiNote = -1;
    }

    /** Fret integer for a MIDI note on this string, or -1 if unplayable. */
    int fretForMidi (int midiNote) const noexcept
    {
        const int fret = midiNote - openMidiNote;
        if (fret < 0 || fret > kMaxFret)
            return -1;
        return fret;
    }

    static constexpr int kMaxFret = 24;
};

} // namespace da::guitar
