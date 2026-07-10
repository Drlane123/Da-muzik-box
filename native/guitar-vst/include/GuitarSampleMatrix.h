#pragma once

#include "FretboardCoordinator.h"
#include <JuceHeader.h>
#include <array>
#include <memory>

namespace da::guitar
{

/**
 * 6 × 25 sample memory matrix — indexed by coordinator stringIdx (0 = low E) and fret 0–24.
 * Files on disk use guitarist string numbers 1 (high e) … 6 (low E):
 *   string_6_fret_0.wav → matrix[0][0]
 *   string_1_fret_0.wav → matrix[5][0]
 */
class GuitarSampleMatrix
{
public:
    static constexpr int kNumStrings = FretboardCoordinator::kNumStrings;
    static constexpr int kNumFrets = 25; // frets 0–24 inclusive

    struct SampleSlot
    {
        std::unique_ptr<juce::AudioBuffer<float>> buffer;
        double sampleRate = 44100.0;
        bool loaded = false;
    };

    GuitarSampleMatrix() = default;

    /** Guitarist string number (1 = high e, 6 = low E) for filename building. */
    static int fileStringNumberFromCoordinatorIndex (int stringIdx) noexcept;

    static juce::String buildExpectedFileName (int coordinatorStringIdx, int fretNum);

    void clear() noexcept;

    void loadFretboardSamples (const juce::File& audioAssetDirectory,
                               juce::AudioFormatManager& formatManager);

    void loadSampleIntoMemoryMatrix (int stringIdx,
                                     int fretNum,
                                     const juce::File& sampleFile,
                                     juce::AudioFormatManager& formatManager);

    const SampleSlot* getSample (int stringIdx, int fretNum) const noexcept;

    int loadedCount() const noexcept { return loadedCount_; }

    juce::File defaultAssetDirectory() const;

private:
    std::array<std::array<SampleSlot, kNumFrets>, kNumStrings> matrix_{};
    int loadedCount_ = 0;
};

} // namespace da::guitar
