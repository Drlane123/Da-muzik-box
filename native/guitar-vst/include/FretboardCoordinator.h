#pragma once

#include "GuitarString.h"
#include "StringVoiceDelegate.h"
#include <JuceHeader.h>
#include <array>
#include <atomic>
#include <vector>

namespace da::guitar
{

/** Result of strict MIDI → string + fret subtraction mapping. */
struct MidiStringConnection
{
    int stringIndex = -1;
    int fret = -1;
    bool isValid() const noexcept { return stringIndex >= 0 && fret >= 0; }
};

/**
 * Left-hand fretboard matrix — sits between incoming MIDI and JUCE Synthesiser voices.
 * Overrides piano-style polyphony with six monophonic string slots.
 */
class FretboardCoordinator
{
public:
    static constexpr int kNumStrings = 6;
    static constexpr int kMinHandPosition = 0;
    static constexpr int kMaxHandPosition = 19;

    FretboardCoordinator();

    void setVoiceDelegate (StringVoiceDelegate* delegate) noexcept { voiceDelegate_ = delegate; }

    /** Current virtual left-hand anchor (capo zone). */
    int getHandPosition() const noexcept { return currentHandPosition_; }

    void setHandPosition (int fret) noexcept;

    const GuitarString& getString (int stringIndex) const noexcept { return strings_[(size_t) stringIndex]; }

    std::array<GuitarString, kNumStrings> snapshot() const noexcept { return strings_; }

    /**
     * Strict mapping: Fret = incomingMidi - openMidiNote per string.
     * Scans string 5 (high e) down to string 0 (low E); first valid fret 0–24 wins.
     */
    MidiStringConnection mapMidiToStringFret (int incomingNote,
                                              uint8_t excludeMask = 0) const noexcept;

    /**
     * Note-on interceptor — connects MIDI to string track + fret, triggers voice.
     * @returns false if note is outside playable range (logged).
     */
    bool connectIncomingMidiNote (int incomingNote, float velocity = 1.0f);

    /**
     * Maps incoming MIDI to a physical string index (0–5).
     * @param excludeMask bit i set => string i already assigned this chord
     * @returns string index or -1 if unplayable
     */
    int allocateNoteToString (int midiNote, uint8_t excludeMask = 0) const noexcept;

    void handleMidiNoteOn (int midiNote, float velocity = 1.0f);
    void handleMidiNoteOff (int midiNote);

    /** Process a MIDI buffer — batches simultaneous note-ons for chord voicing. */
    void processMidiBuffer (const juce::MidiBuffer& midi);

    /** Alias — audio thread MIDI entry (updates string + fret state). */
    void processIncomingMidiBuffer (const juce::MidiBuffer& midi) { processMidiBuffer (midi); }

    void reset() noexcept;

    /** Number of strings that can play midi (for chord voicing sort). */
    int countCandidatesForMidi (int midiNote, uint8_t excludeMask = 0) const noexcept;

    /** Thread-safe UI accessors (audio thread writes, message thread reads). */
    bool isStringActive (int stringIndex) const noexcept;
    int getStringActiveFret (int stringIndex) const noexcept;

private:
    void syncUiStringState (int stringIndex) noexcept;
    void triggerStringVoiceKill (int stringIndex, int oldMidiNote);
    void triggerStringVoicePlay (int stringIndex, int newMidiNote, float velocity, int calculatedFret);
    void triggerStringVoiceRelease (int stringIndex, int midiNote);

    void applyNoteOnToString (int stringIndex, int midiNote, float velocity, int calculatedFret);

    std::array<GuitarString, kNumStrings> strings_{};
    std::array<std::atomic<int>, kNumStrings> uiActiveFret_{};
    int currentHandPosition_ = 0;
    int capoFret_ = 0;
    StringVoiceDelegate* voiceDelegate_ = nullptr;
};

} // namespace da::guitar
