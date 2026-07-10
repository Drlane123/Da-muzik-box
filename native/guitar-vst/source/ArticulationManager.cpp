#include "ArticulationManager.h"

namespace da::guitar
{

ArticulationManager::ArticulationManager() = default;

bool ArticulationManager::isKeyswitchMidi (int midiNote) noexcept
{
    return midiNote >= kKeyswitchMidiLo && midiNote <= kKeyswitchMidiHi;
}

bool ArticulationManager::processIncomingMidiControl (const juce::MidiMessage& message) noexcept
{
    if (! message.isNoteOn() || message.getVelocity() == 0)
        return false;

    const int midiNote = message.getNoteNumber();

    if (! isKeyswitchMidi (midiNote))
        return false;

    switch (midiNote)
    {
        case 24: setArticulation (GuitarArticulation::Sustain);         break;
        case 25: setArticulation (GuitarArticulation::PalmMute);        break;
        case 26: setArticulation (GuitarArticulation::NaturalHarmonic); break;
        case 27: setArticulation (GuitarArticulation::LegatoSlide);     break;
        default: return false;
    }

    return true;
}

bool ArticulationManager::shouldSwallowMidiMessage (const juce::MidiMessage& message) const noexcept
{
    if (! message.isNoteOn() && ! message.isNoteOff())
        return false;

    return isKeyswitchMidi (message.getNoteNumber());
}

GuitarArticulation ArticulationManager::getCurrentArticulation() const noexcept
{
    return static_cast<GuitarArticulation> (currentArticulation_.load (std::memory_order_acquire));
}

int ArticulationManager::getArticulationVersion() const noexcept
{
    return articulationVersion_.load (std::memory_order_acquire);
}

void ArticulationManager::setArticulation (GuitarArticulation articulation) noexcept
{
    currentArticulation_.store (static_cast<int> (articulation), std::memory_order_release);
    articulationVersion_.fetch_add (1, std::memory_order_acq_rel);
}

juce::String ArticulationManager::articulationToDisplayName (GuitarArticulation articulation)
{
    switch (articulation)
    {
        case GuitarArticulation::Sustain:         return "Sustain (Open)";
        case GuitarArticulation::PalmMute:        return "Palm Mute";
        case GuitarArticulation::NaturalHarmonic: return "Natural Harmonic";
        case GuitarArticulation::LegatoSlide:     return "Legato Slide";
    }

    return "Unknown";
}

juce::String ArticulationManager::getArticulationNameAsString() const
{
    return articulationToDisplayName (getCurrentArticulation());
}

} // namespace da::guitar
