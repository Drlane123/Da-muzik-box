#pragma once

#include "ArticulationManager.h"
#include "GuitarSampleMatrix.h"
#include <JuceHeader.h>

namespace da::guitar
{

class GuitarStringVoice : public juce::SynthesiserVoice
{
public:
    explicit GuitarStringVoice (int stringIndex) noexcept;

    int getStringIndex() const noexcept { return stringIndex_; }
    int getCurrentMidiNote() const noexcept { return currentMidiNote_; }
    int getCurrentFret() const noexcept { return currentFret_; }
    bool isVoiceRinging() const noexcept { return isRinging_; }
    GuitarArticulation getArticulation() const noexcept { return articulation_; }

    void setSampleMatrix (const GuitarSampleMatrix* matrix) noexcept { sampleMatrix_ = matrix; }

    bool canPlaySound (juce::SynthesiserSound*) override;
    void startNote (int midiNoteNumber, float velocity,
                    juce::SynthesiserSound*, int) override;
    void startNoteWithArticulation (int midiNoteNumber, float velocity,
                                    juce::SynthesiserSound* sound,
                                    GuitarArticulation articulation,
                                    int calculatedFret);
    void stopNote (float velocity, bool allowTailOff) override;
    void pitchWheelMoved (int) override {}
    void controllerMoved (int, int) override {}

    void renderNextBlock (juce::AudioBuffer<float>& outputBuffer,
                          int startSample, int numSamples) override;

    void forceKill() noexcept;

private:
    void resetPlayback() noexcept;

    int stringIndex_;
    int currentMidiNote_ = -1;
    int currentFret_ = -1;
    float currentVelocity_ = 0.0f;
    bool isRinging_ = false;
    GuitarArticulation articulation_ = GuitarArticulation::Sustain;

    const GuitarSampleMatrix* sampleMatrix_ = nullptr;
    const GuitarSampleMatrix::SampleSlot* activeSlot_ = nullptr;
    double sourceSampleRate_ = 44100.0;
    double playPosition_ = 0.0;
};

} // namespace da::guitar
