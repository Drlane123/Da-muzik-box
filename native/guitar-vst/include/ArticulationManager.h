#pragma once

#include <JuceHeader.h>
#include <atomic>

namespace da::guitar
{

enum class GuitarArticulation : int
{
    Sustain = 0,
    PalmMute,
    NaturalHarmonic,
    LegatoSlide
};

/** C0–D#0 keyswitch zone (non-sounding control keys). */
static constexpr int kKeyswitchMidiLo = 24;
static constexpr int kKeyswitchMidiHi = 27;

/**
 * Global articulation matrix — intercepts keyswitches before fretboard / voices.
 * Thread-safe reads from the message thread (UI); writes on the audio thread.
 */
class ArticulationManager
{
public:
    ArticulationManager();

    static bool isKeyswitchMidi (int midiNote) noexcept;

    /**
     * Returns true if the message was a keyswitch (consumed — do not route to fretboard).
     * Handles NoteOn only; pair with shouldSwallowMidiMessage for NoteOff.
     */
    bool processIncomingMidiControl (const juce::MidiMessage& message) noexcept;

    /** Swallow keyswitch note-offs and control note-ons from playable MIDI path. */
    bool shouldSwallowMidiMessage (const juce::MidiMessage& message) const noexcept;

    GuitarArticulation getCurrentArticulation() const noexcept;
    juce::String getArticulationNameAsString() const;

    /** Bumped on every articulation change — cheap UI dirty flag. */
    int getArticulationVersion() const noexcept;

    static juce::String articulationToDisplayName (GuitarArticulation articulation);

private:
    void setArticulation (GuitarArticulation articulation) noexcept;

    std::atomic<int> currentArticulation_ { static_cast<int> (GuitarArticulation::Sustain) };
    std::atomic<int> articulationVersion_ { 0 };
};

} // namespace da::guitar
