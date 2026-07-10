#pragma once

namespace da::guitar
{

/**
 * Structural bridge between FretboardCoordinator and JUCE voice allocation.
 * No audio rendering — only voice slot commands.
 */
class StringVoiceDelegate
{
public:
    virtual ~StringVoiceDelegate() = default;

    /** Force-stop the voice bound to stringIndex (string already ringing). */
    virtual void killVoiceOnString (int stringIndex, int oldMidiNote) = 0;

    /** Allocate / start the voice on stringIndex for newMidiNote at calculatedFret. */
    virtual void playVoiceOnString (int stringIndex, int newMidiNote, float velocity, int calculatedFret) = 0;

    /** Begin release on stringIndex for midiNote. */
    virtual void releaseVoiceOnString (int stringIndex, int midiNote) = 0;
};

} // namespace da::guitar
