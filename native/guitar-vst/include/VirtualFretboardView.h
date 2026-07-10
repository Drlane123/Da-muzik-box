#pragma once

#include "ArticulationManager.h"
#include "FretboardCoordinator.h"
#include <JuceHeader.h>
#include <array>

namespace da::guitar
{

class VirtualFretboardView : public juce::Component,
                             public juce::Timer
{
public:
    static constexpr int kFretCount = 24;
    static constexpr int kNumStrings = FretboardCoordinator::kNumStrings;

    VirtualFretboardView (FretboardCoordinator& coordinatorToUse,
                          const ArticulationManager& articulationManager);

    ~VirtualFretboardView() override;

    void paint (juce::Graphics& g) override;

    void timerCallback() override;

    void resized() override;

private:
    bool pollStateChanged() noexcept;

    FretboardCoordinator& coordinator_;
    const ArticulationManager& articulationManager_;
    std::array<int, kNumStrings> lastActiveFret_{};
    int lastArticulationVersion_ = -1;
    bool forceRepaint_ = true;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VirtualFretboardView)
};

} // namespace da::guitar
