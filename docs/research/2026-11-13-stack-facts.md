# Stack facts for Meta Glance

Checked on 2026-11-13 against vendor documentation by a research agent. Model IDs, prices, and limits change often. Verify a model ID with one API call before you build on it.

## Consequences for the design

- Use `gemini-3.5-flash-lite` for recognition of one frame. Its default `thinking_level` is `minimal`, which gives the lowest latency. Set the media resolution to low to cut tokens.
- Use the paid Gemini tier. The Google terms require paid services for users in the European Economic Area. The docs publish no rate limits for the free tier.
- Do not use the Live API for the glance. It waits for user input before it responds, and a session with audio and video stops at 2 minutes.
- `gemini-embedding-2` accepts images. Catalog retrieval with Atlas Vector Search is possible on the free cluster.
- Use ElevenLabs `eleven_flash_v2_5` over the HTTP streaming endpoint. Cache each clip, because the free plan has 10,000 credits each month.
- The free Atlas cluster (M0) is enough. Change streams and vector search both work on it.
- Use the Vultr Stockholm region. The smallest plan there costs 5 USD each month.

## Google Gemini API

- The docs moved from `ai.google.dev/gemini-api/docs` to `aistudio.google.com/docs`. https://aistudio.google.com/docs/models
- Stable Flash tiers: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`, `gemini-3.8-flash`. Preview: `gemini-3-flash-preview`. https://aistudio.google.com/docs/models
- `gemini-4-hydrogen` is also stable. The docs recommend "Gemini 4 Hydrogen or 3.5 Flash-Lite" for new projects. https://aistudio.google.com/docs/models
- `gemini-2.5-flash` is deprecated and routes to `gemini-3.5-flash-lite` from December 1, 2026. https://aistudio.google.com/docs/deprecations.md
- Paid price for 1M tokens, input then output: `gemini-3.5-flash-lite` 0.30 and 2.50 USD, `gemini-3.1-flash-lite` 0.25 and 1.50 USD, `gemini-4-hydrogen` 1.50 and 7.50 USD. https://aistudio.google.com/docs/pricing
- Image cost on Gemini 3 and 4: 1120 tokens by default. Levels: `low` 280, `medium` 560, `high` 1120, `ultra_high` 2240. https://aistudio.google.com/docs/media-resolution
- generateContent sets `media_resolution` (Python) or `mediaResolution` (JavaScript) to `MEDIA_RESOLUTION_LOW`. https://aistudio.google.com/docs/media-resolution.md?generate-content=true
- Rate limits: the docs publish no requests-per-minute or requests-per-day figure, free or paid. The limits show in Google AI Studio after sign-in. https://aistudio.google.com/docs/rate-limits
- 1 request each second on the free tier: unverified. One third-party article lists 10 requests each minute and 500 each day for `gemini-3.5-flash-lite`. https://www.scriptbyai.com/gemini-api-free-tier-limits/
- Terms: "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." https://aistudio.google.com/docs/terms
- Structured output works with image input. https://aistudio.google.com/docs/image-understanding
- The Interactions API is the "recommended interface for all new projects". generateContent is "legacy" but "fully supported". https://aistudio.google.com/docs/interactions
- Interactions API, both SDKs: `client.interactions.create` with `response_format` set to `{type: "text", mime_type: "application/json", schema: ...}`. https://aistudio.google.com/docs/structured-output
- generateContent, Python: `config={"response_mime_type": "application/json", "response_json_schema": ...}`. JavaScript: `responseMimeType` and `responseJsonSchema` in `config`. https://aistudio.google.com/docs/structured-output.md?generate-content=true
- Official SDKs: `google-genai` (Python) and `@google/genai` (JavaScript).
- Live models: `gemini-3.8-live` (default), `gemini-3.8-live-extended-thinking`. https://aistudio.google.com/docs/models
- Live sessions without context window compression: 15 minutes for audio only, 2 minutes for audio and video. https://aistudio.google.com/docs/live-api/session-management
- Live video input: single JPEG or PNG frames, "max 1 frame per second". Output is audio only. https://aistudio.google.com/docs/live-api/capabilities
- "Live API expects user input before it responds." https://aistudio.google.com/docs/live-api/best-practices.md
- Ephemeral tokens work only with the Live API. https://aistudio.google.com/docs/ephemeral-tokens
- Embeddings: `gemini-embedding-2` accepts text, image, video, audio, and PDF (6 images in one request). `gemini-embedding-001` is text only. https://aistudio.google.com/docs/embeddings
- Latency: the docs give no figure for a request with one image. `thinking_level` `minimal` is the default on `gemini-3.5-flash-lite`. `gemini-4-hydrogen` defaults to `high`. https://aistudio.google.com/docs/thinking

## ElevenLabs

- `eleven_flash_v2_5` and `eleven_v4_turbo` tie for lowest latency, at about 100 ms median to first audio, measured on the server. https://elevenlabs.io/docs/eleven-api/concepts/latency-methodology
- `eleven_flash_v2_5` is "designed for real-time applications". `eleven_v4_turbo` "is available via the Text to Dialogue websocket". https://elevenlabs.io/docs/overview/models.md
- Languages: `eleven_flash_v2_5` supports 32, including English, Italian, and Finnish. https://elevenlabs.io/docs/models
- HTTP streaming: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream` with header `xi-api-key`. Defaults: `output_format=mp3_44100_128`, `model_id=eleven_multilingual_v2`. https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- WebSocket input streaming: `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`. https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input
- Output formats: `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32` to `mp3_44100_192`, `pcm_8000` to `pcm_48000`, `opus_48000_32` to `opus_48000_192`. `mp3_44100_192` needs the Creator plan. `pcm_44100` needs the Pro plan. https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- Free plan: 10,000 credits each month. Starter plan: 6 USD each month with 30,000 credits. Credits for each character vary by model. https://elevenlabs.io/pricing
- "Most of our API endpoints are available for all plans, including the free plan." https://elevenlabs.io/docs/help-center/technical/how-much-does-it-cost-to-use-the-api.md
- Speech to text: `scribe_v3` for recorded audio. Realtime: `scribe_v2_realtime` and `scribe_v3_live` at `wss://api.elevenlabs.io/v1/speech-to-text/realtime`. https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
- ElevenAgents is the voice agent product. It has a WebSocket API, Kotlin and Swift SDKs, and tool calls. https://elevenlabs.io/docs/agents-platform/overview

## MongoDB Atlas

- Free cluster (M0): 0.5 GB storage, 500 connections, 100 operations each second, one cluster for each project. Atlas pauses it after 30 days with no connection. https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- Change streams on M0: the limits page lists one restriction only (database-name filters), so they work. https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- Vector Search on M0: available, with at most 3 search or vector indexes. https://www.mongodb.com/docs/vector-search/deployment/compatibility-limitations/
- Node.js: the `mongodb` driver, version 7. https://www.mongodb.com/docs/drivers/node/current/
- Python: PyMongo 4. Async code uses `AsyncMongoClient` from PyMongo. The docs tell Motor users to migrate to it. https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/migration/

## Astryx (UI components)

Source: `https://github.com/meta/astryx`, read on 2026-11-13. The team chose Astryx for the components.

- Astryx is the open source design system of Meta. License MIT. Status: beta. Docs: `https://astryx.atmeta.com`.
- It is built on React 19 and StyleX. It ships more than 150 accessible components, page templates, dark mode, and a CLI.
- Install: `@astryxdesign/core`, one theme package, and `@stylexjs/stylex`. Dev dependency: `@astryxdesign/cli`.
- Simplest setup: import `@astryxdesign/core/reset.css`, `@astryxdesign/core/astryx.css`, and the `theme.css` of the theme, in that order. Wrap the app in `<Theme theme={...}>`.
- A theme is a layer of CSS custom property overrides. `defineTheme` sets typography, palettes with light and dark values, and overrides for single components. `astryx docs theme` is the guide. `astryx theme build` builds the theme CSS.
- Stock themes: neutral, butter, chocolate, matcha, stone, gothic, y2k.
- Agent workflow: `npx @astryxdesign/cli init` writes the component index into `AGENTS.md` and `CLAUDE.md`. `astryx component <Name>` prints the full docs of a component. `astryx template --list` lists page templates. The repository also ships an agent skill in `plugins/astryx/skills/astryx/SKILL.md`.
- Use the scoped name `@astryxdesign/cli` with `npx`. The unscoped `astryx` package on npm is unrelated.
- No Android binding exists. `@astryxdesign/native` is experimental, canary only, and has a Swift binding. Its README states: "React Native and Android bindings are not built yet".
- Consequence: on the phone, Astryx screens run in a WebView inside the Kotlin app.
- Astryx does not target the Meta Ray-Ban Display. The Display HUD uses `@wearables-ui-toolkit/mrbd`.

## Vultr

- Smallest plan in Stockholm: `vc2-1c-1gb` with 1 vCPU, 1 GB RAM, 25 GB disk, for 5 USD each month. https://api.vultr.com/v2/plans?type=vc2&per_page=100
- Vultr has no Finland region. Stockholm (`sto`) is the nearest. https://api.vultr.com/v2/regions?per_page=100
- The Marketplace has a "Docker" app that deploys Docker on Ubuntu 24.04. https://api.vultr.com/v2/applications?per_page=500
