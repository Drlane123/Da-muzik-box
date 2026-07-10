#pragma once

/**
 * Da Guitar — JUCE six-string instrument (structural backbone).
 *
 * Layout:
 *   MIDI in
 *     → FretboardCoordinator (left hand: string allocation + monophony)
 *     → GuitarStringSynthesiser / GuitarStringVoice[6] (right-hand voice slots)
 *     → (future) sample engine + DSP rack
 */

#include "GuitarString.h"
#include "StringVoiceDelegate.h"
#include "GuitarSampleMatrix.h"
#include "ArticulationManager.h"
#include "FretboardCoordinator.h"
#include "GuitarStrummerEngine.h"
#include "GuitarStringVoice.h"
#include "GuitarStringSynthesiser.h"
#include "VirtualFretboardView.h"
#include "DaGuitarAudioProcessor.h"
#include "DaGuitarAudioProcessorEditor.h"
