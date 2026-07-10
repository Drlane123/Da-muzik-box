#include "GuitarStringVoice.h"

namespace da::guitar
{

GuitarStringVoice::GuitarStringVoice (int stringIndex) noexcept
    : stringIndex_ (stringIndex)
{
}

bool GuitarStringVoice::canPlaySound (juce::SynthesiserSound*)
{
    return true;
}

void GuitarStringVoice::startNote (int midiNoteNumber, float velocity,
                                   juce::SynthesiserSound* sound, int currentPitchWheelPosition)
{
    startNoteWithArticulation (midiNoteNumber, velocity, sound, GuitarArticulation::Sustain, -1);
    juce::ignoreUnused (currentPitchWheelPosition);
}

void GuitarStringVoice::startNoteWithArticulation (int midiNoteNumber, float velocity,
                                                   juce::SynthesiserSound* sound,
                                                   GuitarArticulation articulation,
                                                   int calculatedFret)
{
    juce::ignoreUnused (sound);

    currentMidiNote_ = midiNoteNumber;
    currentVelocity_ = velocity;
    articulation_ = articulation;
    currentFret_ = calculatedFret;
    isRinging_ = true;
    playPosition_ = 0.0;
    activeSlot_ = nullptr;
    sourceSampleRate_ = 44100.0;

    if (sampleMatrix_ != nullptr && calculatedFret >= 0)
    {
        activeSlot_ = sampleMatrix_->getSample (stringIndex_, calculatedFret);
        if (activeSlot_ != nullptr)
            sourceSampleRate_ = activeSlot_->sampleRate;
    }
}

void GuitarStringVoice::stopNote (float, bool allowTailOff)
{
    juce::ignoreUnused (allowTailOff);
    forceKill();
}

void GuitarStringVoice::forceKill() noexcept
{
    resetPlayback();
    clearCurrentNote();
}

void GuitarStringVoice::resetPlayback() noexcept
{
    isRinging_ = false;
    currentMidiNote_ = -1;
    currentFret_ = -1;
    currentVelocity_ = 0.0f;
    articulation_ = GuitarArticulation::Sustain;
    activeSlot_ = nullptr;
    playPosition_ = 0.0;
}

void GuitarStringVoice::renderNextBlock (juce::AudioBuffer<float>& outputBuffer,
                                         int startSample, int numSamples)
{
    if (! isRinging_ || activeSlot_ == nullptr || activeSlot_->buffer == nullptr)
        return;

    const auto& source = *activeSlot_->buffer;
    const int sourceLength = source.getNumSamples();
    if (sourceLength <= 0)
        return;

    const double hostRate = getSampleRate() > 0.0 ? getSampleRate() : sourceSampleRate_;
    const double rateRatio = sourceSampleRate_ / hostRate;
    const float gain = currentVelocity_;

    for (int i = 0; i < numSamples; ++i)
    {
        const int sourceIndex = (int) playPosition_;
        if (sourceIndex >= sourceLength)
        {
            forceKill();
            break;
        }

        for (int ch = 0; ch < outputBuffer.getNumChannels(); ++ch)
        {
            const int sourceChannel = juce::jmin (ch, source.getNumChannels() - 1);
            outputBuffer.addSample (ch, startSample + i, source.getSample (sourceChannel, sourceIndex) * gain);
        }

        playPosition_ += rateRatio;
    }
}

} // namespace da::guitar
