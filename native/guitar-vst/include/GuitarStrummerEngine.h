#pragma once

#include <JuceHeader.h>
#include <vector>

namespace da::guitar
{

class FretboardCoordinator;

/** One pluck in a strum sequence — sample-accurate delay from strum origin. */
struct StrumNoteEvent
{
    int midiNote = 0;
    int stringIndex = 0;
    int sampleDelayOffset = 0;
    float velocity = 1.0f;
};

/**
 * Right-hand strummer — staggered string plucks (down: string 6→1, up: string 1→6).
 * Audio thread only.
 */
class GuitarStrummerEngine
{
public:
  #if JUCE_MSVC
    #pragma warning (push)
    #pragma warning (disable : 4251)
  #endif

    void reset() noexcept;

    void setSampleRate (double sampleRate) noexcept { sampleRate_ = sampleRate; }

    /**
     * Build strum queue from chord MIDI using coordinator string allocation.
     * Downstrum: stringIndex 0 → 5 (low E first). Upstrum: 5 → 0.
     */
    void queueChordStrum (const std::vector<int>& midiNotes,
                          bool isDownstrum,
                          float strumSpeedMs,
                          double sampleRate,
                          FretboardCoordinator& coordinator,
                          float velocity = 1.0f);

    /**
     * Advance timers by numSamples; inject NoteOn at sample offsets into midiMessages.
     * @returns true if strum queue still has pending events
     */
    bool processStrumTimeBuffers (juce::MidiBuffer& midiMessages,
                                  int numSamples,
                                  int midiChannel = 1);

    bool hasPendingStrum() const noexcept { return ! pendingEvents_.empty(); }

  #if JUCE_MSVC
    #pragma warning (pop)
  #endif

private:
    struct PendingStrumEvent
    {
        int midiNote = 0;
        int stringIndex = 0;
        int samplesRemaining = 0;
        float velocity = 1.0f;
    };

    static int strumDelaySamplesForString (int stringIndex, bool isDownstrum, int delayPerString) noexcept;

    double sampleRate_ = 44100.0;
    std::vector<PendingStrumEvent> pendingEvents_;
};

} // namespace da::guitar
