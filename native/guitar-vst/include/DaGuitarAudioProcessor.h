#pragma once

#include "FretboardCoordinator.h"
#include "GuitarStrummerEngine.h"
#include "GuitarSampleMatrix.h"
#include "ArticulationManager.h"
#include <JuceHeader.h>
#include <array>
#include <atomic>

namespace da::guitar
{

class DaGuitarAudioProcessor : public juce::AudioProcessor
{
public:
    DaGuitarAudioProcessor();
    ~DaGuitarAudioProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Da Guitar"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override {}
    void setStateInformation (const void*, int) override {}

    FretboardCoordinator& getFretboardCoordinator() noexcept { return fretboard_; }
    const FretboardCoordinator& getFretboardCoordinator() const noexcept { return fretboard_; }

    const GuitarSampleMatrix& getSampleMatrix() const noexcept { return sampleMatrix_; }

    ArticulationManager& getArticulationManager() noexcept { return articulationManager_; }
    const ArticulationManager& getArticulationManager() const noexcept { return articulationManager_; }

    void setStrumDown (bool down) noexcept { strumDown_.store (down, std::memory_order_relaxed); }
    bool isStrumDown() const noexcept { return strumDown_.load (std::memory_order_relaxed); }

    void setStrumSpeedMs (float ms) noexcept { strumSpeedMs_.store (ms, std::memory_order_relaxed); }
    float getStrumSpeedMs() const noexcept { return strumSpeedMs_.load (std::memory_order_relaxed); }

private:
    struct StringPlaybackState
    {
        int activeFret = -1;
        double playhead = 0.0;
        float gain = 0.85f;
    };

    void filterKeyswitchMidi (juce::MidiBuffer& midiMessages) noexcept;
    void routeIncomingMidi (juce::MidiBuffer& midiMessages);
    void processIncomingMidiPipeline (juce::MidiBuffer& midiMessages, int numSamples);

    void renderStringAudioToOutput (int stringIdx,
                                    const GuitarSampleMatrix::SampleSlot& sampleSlot,
                                    juce::AudioBuffer<float>& outputBuffer,
                                    StringPlaybackState& playback);

    void renderMatrixToOutput (juce::AudioBuffer<float>& buffer);

    ArticulationManager articulationManager_;
    FretboardCoordinator fretboard_;
    GuitarStrummerEngine strummer_;
    GuitarSampleMatrix sampleMatrix_;
    juce::AudioFormatManager formatManager_;

    std::array<StringPlaybackState, GuitarSampleMatrix::kNumStrings> stringPlayback_{};
    double sampleRate_ = 44100.0;
    std::atomic<bool> strumDown_ { true };
    std::atomic<float> strumSpeedMs_ { 20.0f };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (DaGuitarAudioProcessor)
};

} // namespace da::guitar
