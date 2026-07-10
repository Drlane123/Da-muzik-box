#include "FretboardCoordinator.h"
#include <algorithm>

namespace da::guitar
{

FretboardCoordinator::FretboardCoordinator()
{
    const int standardTuning[kNumStrings] = { 40, 45, 50, 55, 59, 64 };

    for (int i = 0; i < kNumStrings; ++i)
    {
        strings_[(size_t) i].openMidiNote = standardTuning[i];
        uiActiveFret_[(size_t) i].store (-1, std::memory_order_relaxed);
    }
}

void FretboardCoordinator::setHandPosition (int fret) noexcept
{
    currentHandPosition_ = juce::jlimit (kMinHandPosition, kMaxHandPosition, fret);
}

MidiStringConnection FretboardCoordinator::mapMidiToStringFret (int incomingNote,
                                                                  uint8_t excludeMask) const noexcept
{
    MidiStringConnection result;

    for (int stringIdx = kNumStrings - 1; stringIdx >= 0; --stringIdx)
    {
        if ((excludeMask & static_cast<uint8_t> (1 << stringIdx)) != 0)
            continue;

        const int fret = incomingNote - strings_[(size_t) stringIdx].openMidiNote;

        if (fret >= 0 && fret <= GuitarString::kMaxFret)
        {
            result.stringIndex = stringIdx;
            result.fret = fret;
            return result;
        }
    }

    return result;
}

int FretboardCoordinator::allocateNoteToString (int midiNote, uint8_t excludeMask) const noexcept
{
    return mapMidiToStringFret (midiNote, excludeMask).stringIndex;
}

int FretboardCoordinator::countCandidatesForMidi (int midiNote, uint8_t excludeMask) const noexcept
{
    int count = 0;

    for (int stringIdx = kNumStrings - 1; stringIdx >= 0; --stringIdx)
    {
        if ((excludeMask & static_cast<uint8_t> (1 << stringIdx)) != 0)
            continue;

        const int fret = midiNote - strings_[(size_t) stringIdx].openMidiNote;
        if (fret >= 0 && fret <= GuitarString::kMaxFret)
            ++count;
    }

    return count;
}

bool FretboardCoordinator::connectIncomingMidiNote (int incomingNote, float velocity)
{
    const auto connection = mapMidiToStringFret (incomingNote);

    if (! connection.isValid())
    {
        juce::Logger::writeToLog ("Error: MIDI Note " + juce::String (incomingNote)
                                  + " is outside the playable range of this guitar.");
        return false;
    }

    const int displayStringNumber = connection.stringIndex + 1;

    juce::Logger::writeToLog ("Connected MIDI " + juce::String (incomingNote)
                              + " to String " + juce::String (displayStringNumber)
                              + ", Fret " + juce::String (connection.fret));

    applyNoteOnToString (connection.stringIndex, incomingNote, velocity, connection.fret);
    return true;
}

void FretboardCoordinator::applyNoteOnToString (int stringIndex,
                                                int midiNote,
                                                float velocity,
                                                int calculatedFret)
{
    if (stringIndex < 0 || stringIndex >= kNumStrings)
        return;

    if (calculatedFret < 0 || calculatedFret > GuitarString::kMaxFret)
        return;

    auto& str = strings_[(size_t) stringIndex];

    if (str.isRinging)
        triggerStringVoiceKill (stringIndex, str.activeMidiNote);

    str.currentFret = calculatedFret;
    str.isRinging = true;
    str.activeMidiNote = midiNote;

    currentHandPosition_ = juce::jlimit (kMinHandPosition, kMaxHandPosition, calculatedFret);

    triggerStringVoicePlay (stringIndex, midiNote, velocity, calculatedFret);
    syncUiStringState (stringIndex);
}

void FretboardCoordinator::handleMidiNoteOn (int midiNote, float velocity)
{
    connectIncomingMidiNote (midiNote, velocity);
}

void FretboardCoordinator::handleMidiNoteOff (int midiNote)
{
    for (int i = 0; i < kNumStrings; ++i)
    {
        if (strings_[(size_t) i].activeMidiNote == midiNote)
        {
            strings_[(size_t) i].isRinging = false;
            strings_[(size_t) i].currentFret = -1;
            strings_[(size_t) i].activeMidiNote = -1;
            triggerStringVoiceRelease (i, midiNote);
            syncUiStringState (i);
            break;
        }
    }
}

void FretboardCoordinator::processMidiBuffer (const juce::MidiBuffer& midi)
{
    struct PendingOn { int midi = 0; float velocity = 0.0f; };
    std::vector<PendingOn> chordBatch;
    chordBatch.reserve (6);
    int batchSamplePos = -1;

    auto flushBatch = [this, &chordBatch]()
    {
        if (chordBatch.empty())
            return;

        uint8_t usedMask = 0;

        std::sort (chordBatch.begin(), chordBatch.end(),
                   [this] (const PendingOn& a, const PendingOn& b)
                   {
                       const int ca = countCandidatesForMidi (a.midi, 0);
                       const int cb = countCandidatesForMidi (b.midi, 0);
                       if (ca != cb)
                           return ca < cb;
                       return a.midi > b.midi;
                   });

        for (const auto& note : chordBatch)
        {
            const auto connection = mapMidiToStringFret (note.midi, usedMask);
            if (! connection.isValid())
            {
                juce::Logger::writeToLog ("Error: MIDI Note " + juce::String (note.midi)
                                          + " is outside the playable range of this guitar.");
                continue;
            }

            juce::Logger::writeToLog ("Connected MIDI " + juce::String (note.midi)
                                      + " to String " + juce::String (connection.stringIndex + 1)
                                      + ", Fret " + juce::String (connection.fret));

            usedMask = static_cast<uint8_t> (usedMask | static_cast<uint8_t> (1 << connection.stringIndex));
            applyNoteOnToString (connection.stringIndex, note.midi, note.velocity, connection.fret);
        }

        chordBatch.clear();
    };

    for (const auto metadata : midi)
    {
        const auto msg = metadata.getMessage();

        if (msg.isNoteOn() && msg.getVelocity() > 0)
        {
            if (batchSamplePos >= 0 && metadata.samplePosition != batchSamplePos)
                flushBatch();

            batchSamplePos = metadata.samplePosition;
            chordBatch.push_back ({ msg.getNoteNumber(), msg.getFloatVelocity() });
            continue;
        }

        flushBatch();
        batchSamplePos = -1;

        if (msg.isNoteOff() || (msg.isNoteOn() && msg.getVelocity() == 0))
            handleMidiNoteOff (msg.getNoteNumber());
    }

    flushBatch();
}

void FretboardCoordinator::reset() noexcept
{
    for (auto& s : strings_)
        s.reset();

    for (auto& f : uiActiveFret_)
        f.store (-1, std::memory_order_relaxed);

    currentHandPosition_ = 0;
}

bool FretboardCoordinator::isStringActive (int stringIndex) const noexcept
{
    if (stringIndex < 0 || stringIndex >= kNumStrings)
        return false;

    return uiActiveFret_[(size_t) stringIndex].load (std::memory_order_acquire) >= 0;
}

int FretboardCoordinator::getStringActiveFret (int stringIndex) const noexcept
{
    if (stringIndex < 0 || stringIndex >= kNumStrings)
        return -1;

    return uiActiveFret_[(size_t) stringIndex].load (std::memory_order_acquire);
}

void FretboardCoordinator::syncUiStringState (int stringIndex) noexcept
{
    if (stringIndex < 0 || stringIndex >= kNumStrings)
        return;

    const auto& str = strings_[(size_t) stringIndex];
    const int fret = str.isRinging ? str.currentFret : -1;
    uiActiveFret_[(size_t) stringIndex].store (fret, std::memory_order_release);
}

void FretboardCoordinator::triggerStringVoiceKill (int stringIndex, int oldMidiNote)
{
    if (voiceDelegate_ != nullptr)
        voiceDelegate_->killVoiceOnString (stringIndex, oldMidiNote);
}

void FretboardCoordinator::triggerStringVoicePlay (int stringIndex, int newMidiNote, float velocity, int calculatedFret)
{
    if (voiceDelegate_ != nullptr)
        voiceDelegate_->playVoiceOnString (stringIndex, newMidiNote, velocity, calculatedFret);
}

void FretboardCoordinator::triggerStringVoiceRelease (int stringIndex, int midiNote)
{
    if (voiceDelegate_ != nullptr)
        voiceDelegate_->releaseVoiceOnString (stringIndex, midiNote);
}

} // namespace da::guitar
