#!/usr/bin/env bash
set -euo pipefail

# android-emulator-runner starts each script entry in a separate shell. Keep
# directory changes and both Gradle invocations inside this single process.
cd "$(dirname "$0")/../android"
chmod +x gradlew
./gradlew assembleDebug assembleDebugAndroidTest --no-daemon
adb shell settings put secure location_mode 3
adb emu geo fix -87.63 41.88
./gradlew connectedDebugAndroidTest --no-daemon -Pandroid.testInstrumentationRunnerArguments.class=com.chiltonappworks.chaos86.NativeCapabilitiesTest
