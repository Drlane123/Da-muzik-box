#include "GuitarSampleMatrix.h"

namespace da::guitar
{

int GuitarSampleMatrix::fileStringNumberFromCoordinatorIndex (int stringIdx) noexcept
{
    return kNumStrings - stringIdx;
}

juce::String GuitarSampleMatrix::buildExpectedFileName (int coordinatorStringIdx, int fretNum)
{
    const int stringNumForFile = fileStringNumberFromCoordinatorIndex (coordinatorStringIdx);
    return "string_" + juce::String (stringNumForFile) + "_fret_" + juce::String (fretNum) + ".wav";
}

void GuitarSampleMatrix::clear() noexcept
{
    for (auto& row : matrix_)
        for (auto& slot : row)
        {
            slot.buffer.reset();
            slot.loaded = false;
            slot.sampleRate = 44100.0;
        }

    loadedCount_ = 0;
}

juce::File GuitarSampleMatrix::defaultAssetDirectory() const
{
    const auto exeDir = juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                            .getParentDirectory();

    const juce::File candidates[] = {
        exeDir.getChildFile ("guitar_samples"),
        exeDir.getChildFile ("assets").getChildFile ("samples"),
        juce::File::getCurrentWorkingDirectory()
            .getChildFile ("native")
            .getChildFile ("guitar-vst")
            .getChildFile ("assets")
            .getChildFile ("samples"),
    };

    for (const auto& dir : candidates)
        if (dir.isDirectory())
            return dir;

    return candidates[0];
}

void GuitarSampleMatrix::loadSampleIntoMemoryMatrix (int stringIdx,
                                                     int fretNum,
                                                     const juce::File& sampleFile,
                                                     juce::AudioFormatManager& formatManager)
{
    if (stringIdx < 0 || stringIdx >= kNumStrings || fretNum < 0 || fretNum >= kNumFrets)
        return;

    if (! sampleFile.existsAsFile())
        return;

    std::unique_ptr<juce::AudioFormatReader> reader (formatManager.createReaderFor (sampleFile));
    if (reader == nullptr)
    {
        juce::Logger::writeToLog ("Warning: Could not decode sample: " + sampleFile.getFullPathName());
        return;
    }

    auto& slot = matrix_[(size_t) stringIdx][(size_t) fretNum];
    const bool wasLoaded = slot.loaded;

    slot.buffer = std::make_unique<juce::AudioBuffer<float>> ((int) reader->numChannels,
                                                              (int) reader->lengthInSamples);
    reader->read (slot.buffer.get(), 0, (int) reader->lengthInSamples, 0, true, true);
    slot.sampleRate = reader->sampleRate;
    slot.loaded = true;

    if (! wasLoaded)
        ++loadedCount_;

    juce::Logger::writeToLog ("Loaded infrastructure sample [stringIdx="
                              + juce::String (stringIdx) + "][fret="
                              + juce::String (fretNum) + "] from "
                              + sampleFile.getFileName());
}

void GuitarSampleMatrix::loadFretboardSamples (const juce::File& audioAssetDirectory,
                                               juce::AudioFormatManager& formatManager)
{
    clear();

    if (! audioAssetDirectory.isDirectory())
    {
        juce::Logger::writeToLog ("Warning: Sample asset directory not found: "
                                  + audioAssetDirectory.getFullPathName());
        return;
    }

    juce::Logger::writeToLog ("Loading fretboard samples from: "
                              + audioAssetDirectory.getFullPathName());

    for (int stringIdx = 0; stringIdx < kNumStrings; ++stringIdx)
    {
        for (int fretNum = 0; fretNum < kNumFrets; ++fretNum)
        {
            const auto expectedFileName = buildExpectedFileName (stringIdx, fretNum);
            const juce::File sampleFile = audioAssetDirectory.getChildFile (expectedFileName);

            if (sampleFile.existsAsFile())
            {
                loadSampleIntoMemoryMatrix (stringIdx, fretNum, sampleFile, formatManager);
            }
            else
            {
                juce::Logger::writeToLog ("Warning: Missing infrastructure sample asset: "
                                            + expectedFileName);
            }
        }
    }

    juce::Logger::writeToLog ("Fretboard sample matrix ready: " + juce::String (loadedCount_)
                              + " / " + juce::String (kNumStrings * kNumFrets) + " slots loaded");
}

const GuitarSampleMatrix::SampleSlot* GuitarSampleMatrix::getSample (int stringIdx,
                                                                     int fretNum) const noexcept
{
    if (stringIdx < 0 || stringIdx >= kNumStrings || fretNum < 0 || fretNum >= kNumFrets)
        return nullptr;

    const auto& slot = matrix_[(size_t) stringIdx][(size_t) fretNum];
    return slot.loaded ? &slot : nullptr;
}

} // namespace da::guitar
