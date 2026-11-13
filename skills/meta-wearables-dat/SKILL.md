---
name: meta-wearables-dat
description: Meta Wearables Device Access Toolkit (DAT) for native iOS (Swift) and Android (Kotlin) apps that connect to Ray-Ban Meta and Ray-Ban Display glasses - SDK setup, registration, permissions, device sessions, camera streaming, photo capture, audio, speech, motion, inputs, display API, voice invocations, MockDeviceKit, debugging. Use for any code that talks to the glasses from a phone.
---

# Meta Wearables DAT SDK

This skill bundles Meta's official DAT skills for both platforms. Each topic is
one reference file. Read only the files that the task needs.

## Workflow

1. Select the platform: `references/ios/` (Swift) or `references/android/`
   (Kotlin). Never copy an API from one platform to the other. The two SDKs
   use different types and naming.
2. Read `dat-conventions.md` for that platform before you write SDK code.
3. Read the topic files from the table below.
4. To get exact, current API symbols, query the `wearables-dat` MCP server
   (`search_dat_docs`). This repository configures it in `.mcp.json`. If MCP
   is not available, use https://wearables.developer.meta.com/llms.txt?full=true.
   Include the platform and the API name in each query, for example
   `iOS MWDATCamera StreamConfiguration frameRate`.

## Topics

The file names are the same in `references/ios/` and `references/android/`.

| File | Use for |
|---|---|
| `getting-started.md` | SDK install (SwiftPM or Gradle), Info.plist or AndroidManifest, first connection |
| `dat-conventions.md` | Language patterns, naming, key types |
| `permissions-registration.md` | App registration with Meta AI, permission flows |
| `session-lifecycle.md` | Session states, pause and resume, device availability |
| `camera-streaming.md` | Video stream, frames, resolution and frame rate |
| `camera-capture.md` | Standalone high-quality photo capture |
| `audio-streaming.md` | Synchronized PCM audio frames |
| `speech.md` | Speech recognition on the glasses, partial and final transcripts |
| `motion.md` | Accelerometer, gyroscope, magnetometer, orientation |
| `inputs.md` | Navigation, button, capture, and drag input events |
| `display-access.md` | Display capability, display UI DSL, icons, buttons, images, video |
| `voice-invocations.md` | Launch the app from "Hey Meta" voice commands |
| `sample-app-guide.md` | End-to-end sample app with streaming and photo capture |
| `mockdevice-testing.md` | MockDeviceKit, testing without glasses |
| `debugging.md` | Common issues, Developer Mode, version compatibility |
| `live-debugging-mcp.md` | Local DAT Inspector MCP for live device events |
| `dat-docs-mcp.md` | Setup of the hosted DAT docs MCP server for other agents |

## Scope

- Use `mrbd-ui-toolkit` for React web apps that render on the Ray-Ban Display.
- Use `display-access.md` from this skill for display UI that a native phone
  app drives through the DAT SDK.

## Source

- iOS: https://github.com/meta/meta-wearables-dat-ios (`plugins/mwdat-ios/skills/`,
  commit `bbae597cd1c748cd29b9375a1624a8d75b1c9e14`)
- Android: https://github.com/meta/meta-wearables-dat-android
  (`plugins/mwdat-android/skills/`, commit `f4371bc9f90249d51eb07d7f8a61e8d829294f16`)
- Each upstream `skills/<topic>/SKILL.md` is copied unchanged to
  `references/<platform>/<topic>.md`.
- Terms: Meta Wearables Developer Terms, see `LICENSE`.
