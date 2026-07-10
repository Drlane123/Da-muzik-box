#pragma once

#include "DaGuitarAudioProcessor.h"
#include "VirtualFretboardView.h"
#include <JuceHeader.h>

namespace da::guitar
{

class DaGuitarAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit DaGuitarAudioProcessorEditor (DaGuitarAudioProcessor&);
    ~DaGuitarAudioProcessorEditor() override = default;

    void paint (juce::Graphics& g) override;
    void resized() override;

private:
    DaGuitarAudioProcessor& processor_;
    VirtualFretboardView fretboardView_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (DaGuitarAudioProcessorEditor)
};

} // namespace da::guitar
