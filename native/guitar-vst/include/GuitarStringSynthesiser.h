#pragma once

#include "FretboardCoordinator.h"
#include "ArticulationManager.h"
#include "GuitarSampleMatrix.h"
#include "GuitarStringVoice.h"
#include "StringVoiceDelegate.h"
#include <JuceHeader.h>
#include <array>

namespace da::guitar
{

/** Placeholder sound — real zones attach in sample-engine phase. */
class GuitarStringSound : public juce::SynthesiserSound
{
public:
    bool appliesToNote (int) override { return true; }
    bool appliesToChannel (int) override { return true; }
};

/**
 * Exactly six voices — one per string slot — managed by FretboardCoordinator.
 * Overrides default JUCE note-to-voice assignment with string-index routing.
 */
class GuitarStringSynthesiser : public juce::Synthesiser,
                                public StringVoiceDelegate
{
public:
    static constexpr int kNumStrings = FretboardCoordinator::kNumStrings;

    GuitarStringSynthesiser();

    GuitarStringVoice* voiceForString (int stringIndex) noexcept;
    const GuitarStringVoice* voiceForString (int stringIndex) const noexcept;

    // StringVoiceDelegate — called by FretboardCoordinator
    void killVoiceOnString (int stringIndex, int oldMidiNote) override;
    void playVoiceOnString (int stringIndex, int newMidiNote, float velocity, int calculatedFret) override;
    void releaseVoiceOnString (int stringIndex, int midiNote) override;

    void setCurrentArticulation (GuitarArticulation articulation) noexcept;
    GuitarArticulation getCurrentArticulation() const noexcept { return currentArticulation_; }

    void setSampleMatrix (const GuitarSampleMatrix* matrix) noexcept;

    /** Route MIDI through coordinator instead of default Synthesiser::noteOn. */
    void processMidiViaCoordinator (FretboardCoordinator& coordinator,
                                    const juce::MidiBuffer& midi);

private:
    std::array<GuitarStringVoice*, kNumStrings> stringVoices_{};
    juce::SynthesiserSound::Ptr placeholderSound_;
    GuitarArticulation currentArticulation_ = GuitarArticulation::Sustain;
};

} // namespace da::guitar
