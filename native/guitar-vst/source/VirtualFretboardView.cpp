#include "VirtualFretboardView.h"

namespace da::guitar
{

VirtualFretboardView::VirtualFretboardView (FretboardCoordinator& coordinatorToUse,
                                            const ArticulationManager& articulationManager)
    : coordinator_ (coordinatorToUse),
      articulationManager_ (articulationManager)
{
    for (auto& f : lastActiveFret_)
        f = -2;

    startTimerHz (60);
}

VirtualFretboardView::~VirtualFretboardView()
{
    stopTimer();
}

void VirtualFretboardView::resized()
{
    forceRepaint_ = true;
}

bool VirtualFretboardView::pollStateChanged() noexcept
{
    bool changed = forceRepaint_;
    forceRepaint_ = false;

    for (int i = 0; i < kNumStrings; ++i)
    {
        const int fret = coordinator_.getStringActiveFret (i);
        if (fret != lastActiveFret_[(size_t) i])
        {
            lastActiveFret_[(size_t) i] = fret;
            changed = true;
        }
    }

    const int artVersion = articulationManager_.getArticulationVersion();
    if (artVersion != lastArticulationVersion_)
    {
        lastArticulationVersion_ = artVersion;
        changed = true;
    }

    return changed;
}

void VirtualFretboardView::timerCallback()
{
    if (pollStateChanged())
        repaint();
}

void VirtualFretboardView::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff1a1410));

  #if JUCE_MSVC
    #pragma warning (push)
    #pragma warning (disable : 4244)
  #endif

    const auto bounds = getLocalBounds().toFloat();
    const auto fretboardArea = bounds.withTrimmedTop (28.0f);
    const float stringSpacing = fretboardArea.getHeight() / 7.0f;
    const float fretSpacing = fretboardArea.getWidth() / static_cast<float> (kFretCount + 1);

    g.setColour (juce::Colour (0xffe8c860));
    g.setFont (juce::FontOptions (14.0f).withStyle ("Bold"));
    g.drawText ("Articulation: " + articulationManager_.getArticulationNameAsString(),
                bounds.removeFromTop (26.0f).reduced (8.0f, 2.0f),
                juce::Justification::centredLeft,
                true);

    g.setColour (juce::Colours::silver.withAlpha (0.35f));
    for (int f = 0; f <= kFretCount; ++f)
    {
        const float x = static_cast<float> (f) * fretSpacing;
        g.drawVerticalLine (static_cast<int> (x),
                            fretboardArea.getY(),
                            fretboardArea.getBottom());
    }

    for (int s = 0; s < kNumStrings; ++s)
    {
        const float y = fretboardArea.getY() + static_cast<float> (s + 1) * stringSpacing;
        const float thickness = 0.8f + static_cast<float> (s) * 0.45f;
        const bool active = coordinator_.isStringActive (s);

        g.setColour (active ? juce::Colour (0xffe8c860) : juce::Colours::lightgrey.withAlpha (0.85f));
        g.drawLine (fretboardArea.getX(), y, fretboardArea.getRight(), y, thickness);
    }

    for (int i = 0; i < kNumStrings; ++i)
    {
        if (! coordinator_.isStringActive (i))
            continue;

        int currentFret = coordinator_.getStringActiveFret (i);
        if (currentFret < 0)
            continue;

        float x = fretboardArea.getX() + static_cast<float> (currentFret) * fretSpacing + fretSpacing * 0.5f;
        const float y = fretboardArea.getY() + static_cast<float> (i + 1) * stringSpacing;

        if (currentFret == 0)
            x = fretboardArea.getX() + fretSpacing * 0.35f;

        g.setColour (juce::Colours::cadetblue.brighter (0.35f));
        g.fillEllipse (x - 7.0f, y - 7.0f, 14.0f, 14.0f);

        g.setColour (juce::Colours::white.withAlpha (0.85f));
        g.drawEllipse (x - 7.0f, y - 7.0f, 14.0f, 14.0f, 1.5f);
    }

  #if JUCE_MSVC
    #pragma warning (pop)
  #endif
}

} // namespace da::guitar
