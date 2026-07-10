#include "DaGuitarAudioProcessor.h"
#include "DaGuitarAudioProcessorEditor.h"
#include <vector>

namespace da::guitar
{

DaGuitarAudioProcessor::DaGuitarAudioProcessor()
{
    fretboard_.setVoiceDelegate (nullptr);
}

void DaGuitarAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused (samplesPerBlock);

    sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
    strummer_.setSampleRate (sampleRate_);
    strummer_.reset();

    for (auto& pb : stringPlayback_)
        pb = {};

    formatManager_.registerBasicFormats();
    sampleMatrix_.loadFretboardSamples (sampleMatrix_.defaultAssetDirectory(), formatManager_);

    if (sampleMatrix_.loadedCount() == 0)
        juce::Logger::writeToLog ("Da Guitar: no matrix samples loaded — place string_N_fret_M.wav in assets/samples/");
}

void DaGuitarAudioProcessor::filterKeyswitchMidi (juce::MidiBuffer& midiMessages) noexcept
{
    juce::MidiBuffer filtered;

    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();

        if (articulationManager_.processIncomingMidiControl (msg))
            continue;

        if (articulationManager_.shouldSwallowMidiMessage (msg))
            continue;

        filtered.addEvent (msg, metadata.samplePosition);
    }

    midiMessages.swapWith (filtered);
}

void DaGuitarAudioProcessor::routeIncomingMidi (juce::MidiBuffer& midiMessages)
{
    struct NoteOnEvent { int midi = 0; float velocity = 0.0f; };
    std::vector<NoteOnEvent> noteOns;
    juce::MidiBuffer remaining;

    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();

        if (msg.isNoteOn() && msg.getVelocity() > 0)
        {
            noteOns.push_back ({ msg.getNoteNumber(), msg.getFloatVelocity() });
            continue;
        }

        remaining.addEvent (msg, metadata.samplePosition);
    }

    midiMessages.swapWith (remaining);

    if (noteOns.size() >= 2)
    {
        std::vector<int> chordMidis;
        chordMidis.reserve (noteOns.size());
        float avgVel = 0.0f;

        for (const auto& n : noteOns)
        {
            chordMidis.push_back (n.midi);
            avgVel += n.velocity;
        }

        avgVel /= static_cast<float> (noteOns.size());

        strummer_.queueChordStrum (chordMidis,
                                  isStrumDown(),
                                  getStrumSpeedMs(),
                                  sampleRate_,
                                  fretboard_,
                                  avgVel);
        return;
    }

    if (noteOns.size() == 1)
    {
        const auto& n = noteOns.front();
        fretboard_.connectIncomingMidiNote (n.midi, n.velocity);
    }
}

void DaGuitarAudioProcessor::processIncomingMidiPipeline (juce::MidiBuffer& midiMessages,
                                                          int numSamples)
{
    routeIncomingMidi (midiMessages);

    juce::MidiBuffer strummedMidi;
    strummer_.processStrumTimeBuffers (strummedMidi, numSamples, 1);

    for (const auto metadata : strummedMidi)
        midiMessages.addEvent (metadata.getMessage(), metadata.samplePosition);

    fretboard_.processIncomingMidiBuffer (midiMessages);
}

void DaGuitarAudioProcessor::renderStringAudioToOutput (int stringIdx,
                                                        const GuitarSampleMatrix::SampleSlot& sampleSlot,
                                                        juce::AudioBuffer<float>& outputBuffer,
                                                        StringPlaybackState& playback)
{
    juce::ignoreUnused (stringIdx);

    if (! sampleSlot.loaded || sampleSlot.buffer == nullptr)
        return;

    const auto& src = *sampleSlot.buffer;
    const int srcLen = src.getNumSamples();
    if (srcLen <= 0)
        return;

    const double rateRatio = sampleSlot.sampleRate > 0.0
                                 ? sampleSlot.sampleRate / sampleRate_
                                 : 1.0;
    const int numSamples = outputBuffer.getNumSamples();
    const int outChannels = outputBuffer.getNumChannels();
    const int srcChannels = src.getNumChannels();

    for (int i = 0; i < numSamples; ++i)
    {
        const int srcIndex = static_cast<int> (playback.playhead);
        if (srcIndex >= srcLen)
            break;

        float sample = 0.0f;
        for (int c = 0; c < srcChannels; ++c)
            sample += src.getSample (c, srcIndex);
        sample = (sample / static_cast<float> (srcChannels)) * playback.gain;

        for (int ch = 0; ch < outChannels; ++ch)
            outputBuffer.addSample (ch, i, sample);

        playback.playhead += rateRatio;
    }
}

void DaGuitarAudioProcessor::renderMatrixToOutput (juce::AudioBuffer<float>& buffer)
{
    for (int stringIdx = 0; stringIdx < GuitarSampleMatrix::kNumStrings; ++stringIdx)
    {
        if (! fretboard_.isStringActive (stringIdx))
        {
            stringPlayback_[(size_t) stringIdx] = {};
            continue;
        }

        const int currentFret = fretboard_.getStringActiveFret (stringIdx);
        if (currentFret < 0)
        {
            stringPlayback_[(size_t) stringIdx] = {};
            continue;
        }

        auto& playback = stringPlayback_[(size_t) stringIdx];
        if (playback.activeFret != currentFret)
        {
            playback.activeFret = currentFret;
            playback.playhead = 0.0;
        }

        const auto* sampleSlot = sampleMatrix_.getSample (stringIdx, currentFret);
        if (sampleSlot == nullptr || ! sampleSlot->loaded)
            continue;

        renderStringAudioToOutput (stringIdx, *sampleSlot, buffer, playback);
    }
}

void DaGuitarAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                           juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;

    const auto totalNumInputChannels = getTotalNumInputChannels();
    const auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    filterKeyswitchMidi (midiMessages);
    processIncomingMidiPipeline (midiMessages, buffer.getNumSamples());

    renderMatrixToOutput (buffer);
}

juce::AudioProcessorEditor* DaGuitarAudioProcessor::createEditor()
{
    return new DaGuitarAudioProcessorEditor (*this);
}

} // namespace da::guitar

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new da::guitar::DaGuitarAudioProcessor();
}
