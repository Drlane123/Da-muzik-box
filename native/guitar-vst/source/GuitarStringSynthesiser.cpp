#include "GuitarStringSynthesiser.h"

namespace da::guitar
{

GuitarStringSynthesiser::GuitarStringSynthesiser()
{
  #if JUCE_MSVC
    #pragma warning (push)
    #pragma warning (disable : 4996)
  #endif

    for (int i = 0; i < kNumStrings; ++i)
    {
        auto* voice = new GuitarStringVoice (i);
        stringVoices_[(size_t) i] = voice;
        addVoice (voice);
    }

    placeholderSound_ = new GuitarStringSound();
    addSound (placeholderSound_.get());

  #if JUCE_MSVC
    #pragma warning (pop)
  #endif
}

GuitarStringVoice* GuitarStringSynthesiser::voiceForString (int stringIndex) noexcept
{
    if (stringIndex < 0 || stringIndex >= kNumStrings)
        return nullptr;

    return stringVoices_[(size_t) stringIndex];
}

const GuitarStringVoice* GuitarStringSynthesiser::voiceForString (int stringIndex) const noexcept
{
    if (stringIndex < 0 || stringIndex >= kNumStrings)
        return nullptr;

    return stringVoices_[(size_t) stringIndex];
}

void GuitarStringSynthesiser::killVoiceOnString (int stringIndex, int oldMidiNote)
{
    if (auto* voice = voiceForString (stringIndex))
    {
        if (voice->getCurrentMidiNote() == oldMidiNote || voice->isVoiceRinging())
            voice->forceKill();
    }
}

void GuitarStringSynthesiser::playVoiceOnString (int stringIndex, int newMidiNote, float velocity, int calculatedFret)
{
    if (auto* voice = voiceForString (stringIndex))
    {
        if (voice->isVoiceRinging())
            voice->forceKill();

        voice->startNoteWithArticulation (newMidiNote,
                                          velocity,
                                          placeholderSound_.get(),
                                          currentArticulation_,
                                          calculatedFret);
    }
}

void GuitarStringSynthesiser::setCurrentArticulation (GuitarArticulation articulation) noexcept
{
    currentArticulation_ = articulation;
}

void GuitarStringSynthesiser::setSampleMatrix (const GuitarSampleMatrix* matrix) noexcept
{
    for (auto* voice : stringVoices_)
        if (voice != nullptr)
            voice->setSampleMatrix (matrix);
}

void GuitarStringSynthesiser::releaseVoiceOnString (int stringIndex, int midiNote)
{
    if (auto* voice = voiceForString (stringIndex))
    {
        if (voice->getCurrentMidiNote() == midiNote)
            voice->stopNote (0.0f, true);
    }
}

void GuitarStringSynthesiser::processMidiViaCoordinator (FretboardCoordinator& coordinator,
                                                         const juce::MidiBuffer& midi)
{
    coordinator.processMidiBuffer (midi);
}

} // namespace da::guitar
