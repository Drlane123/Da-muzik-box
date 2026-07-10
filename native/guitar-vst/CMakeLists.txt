# Da Guitar — JUCE six-string structural backbone
#
# Requires JUCE submodule or JUCE_PATH environment variable.
# Example: cmake -B build -DJUCE_PATH=/path/to/JUCE

cmake_minimum_required(VERSION 3.22)
project(DaGuitarVST VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT DEFINED JUCE_PATH)
    message(FATAL_ERROR "Set JUCE_PATH to your JUCE checkout (e.g. cmake -DJUCE_PATH=...)")
endif()

add_subdirectory(${JUCE_PATH} juce-build EXCLUDE_FROM_ALL)

juce_add_plugin(DaGuitar
    COMPANY_NAME "DaMusicBox"
    PLUGIN_MANUFACTURER_CODE Dmbx
    PLUGIN_CODE Dgtr
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "Da Guitar"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
)

target_sources(DaGuitar
    PRIVATE
        source/FretboardCoordinator.cpp
        source/ArticulationManager.cpp
        source/GuitarStringVoice.cpp
        source/GuitarStringSynthesiser.cpp
        source/GuitarStrummerEngine.cpp
        source/GuitarSampleMatrix.cpp
        source/VirtualFretboardView.cpp
        source/DaGuitarAudioProcessor.cpp
        source/DaGuitarAudioProcessorEditor.cpp
)

target_include_directories(DaGuitar
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_definitions(DaGuitar
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(DaGuitar
    PRIVATE
        juce::juce_audio_utils
        juce::juce_audio_processors
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
