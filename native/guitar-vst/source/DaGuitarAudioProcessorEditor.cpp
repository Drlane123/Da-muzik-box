#include "DaGuitarAudioProcessorEditor.h"

namespace da::guitar
{

DaGuitarAudioProcessorEditor::DaGuitarAudioProcessorEditor (DaGuitarAudioProcessor& p)
    : juce::AudioProcessorEditor (p),
      processor_ (p),
      fretboardView_ (p.getFretboardCoordinator(), p.getArticulationManager())
{
    addAndMakeVisible (fretboardView_);
    setSize (720, 240);
}

void DaGuitarAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff0e0c10));
}

void DaGuitarAudioProcessorEditor::resized()
{
    fretboardView_.setBounds (getLocalBounds().reduced (8));
}

} // namespace da::guitar
