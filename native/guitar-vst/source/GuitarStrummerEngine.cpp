#include "GuitarStrummerEngine.h"
#include "FretboardCoordinator.h"
#include <algorithm>

namespace da::guitar
{

void GuitarStrummerEngine::reset() noexcept
{
    pendingEvents_.clear();
}

int GuitarStrummerEngine::strumDelaySamplesForString (int stringIndex,
                                                      bool isDownstrum,
                                                      int delayPerString) noexcept
{
    const int orderIndex = isDownstrum ? stringIndex : (FretboardCoordinator::kNumStrings - 1 - stringIndex);
    return orderIndex * delayPerString;
}

void GuitarStrummerEngine::queueChordStrum (const std::vector<int>& midiNotes,
                                            bool isDownstrum,
                                            float strumSpeedMs,
                                            double sampleRate,
                                            FretboardCoordinator& coordinator,
                                            float velocity)
{
    reset();

    if (midiNotes.empty())
        return;

    sampleRate_ = sampleRate > 0.0 ? sampleRate : sampleRate_;
    const int delayPerString = juce::jmax (1,
        static_cast<int> ((strumSpeedMs / 1000.0) * sampleRate_));

    std::vector<int> sorted = midiNotes;
    std::sort (sorted.begin(), sorted.end(),
               [&coordinator] (int a, int b)
               {
                   const int ca = coordinator.countCandidatesForMidi (a, 0);
                   const int cb = coordinator.countCandidatesForMidi (b, 0);
                   if (ca != cb)
                       return ca < cb;
                   return a > b;
               });

    uint8_t usedMask = 0;
    std::vector<StrumNoteEvent> built;
    built.reserve (sorted.size());

    for (const int midi : sorted)
    {
        const int stringIdx = coordinator.allocateNoteToString (midi, usedMask);
        if (stringIdx < 0)
            continue;

        usedMask = static_cast<uint8_t> (usedMask | static_cast<uint8_t> (1 << stringIdx));

        StrumNoteEvent ev;
        ev.midiNote = midi;
        ev.stringIndex = stringIdx;
        ev.velocity = velocity;
        ev.sampleDelayOffset = strumDelaySamplesForString (stringIdx, isDownstrum, delayPerString);
        built.push_back (ev);
    }

    std::sort (built.begin(), built.end(),
               [] (const StrumNoteEvent& a, const StrumNoteEvent& b)
               {
                   return a.sampleDelayOffset < b.sampleDelayOffset;
               });

    pendingEvents_.reserve (built.size());
    for (const auto& ev : built)
    {
        PendingStrumEvent pending;
        pending.midiNote = ev.midiNote;
        pending.stringIndex = ev.stringIndex;
        pending.samplesRemaining = ev.sampleDelayOffset;
        pending.velocity = ev.velocity;
        pendingEvents_.push_back (pending);
    }
}

bool GuitarStrummerEngine::processStrumTimeBuffers (juce::MidiBuffer& midiMessages,
                                                    int numSamples,
                                                    int midiChannel)
{
    if (pendingEvents_.empty())
        return false;

    for (auto it = pendingEvents_.begin(); it != pendingEvents_.end();)
    {
        if (it->samplesRemaining >= numSamples)
        {
            it->samplesRemaining -= numSamples;
            ++it;
            continue;
        }

        const int sampleOffset = juce::jlimit (0, numSamples - 1, it->samplesRemaining);
        const auto msg = juce::MidiMessage::noteOn (midiChannel,
                                                    it->midiNote,
                                                    it->velocity);

        midiMessages.addEvent (msg, sampleOffset);
        it = pendingEvents_.erase (it);
    }

    return ! pendingEvents_.empty();
}

} // namespace da::guitar
