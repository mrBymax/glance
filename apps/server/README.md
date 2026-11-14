# @glance/server

The server of Meta Glance. One Node process runs TypeScript sources with `tsx`. The message types come from `@glance/shared`.

This file describes only the parts that exist. The plan is `docs/superpowers/plans/2026-11-14-glance-1-server.md`.

## What exists

| Path | Content |
|---|---|
| `src/config.ts` | `loadConfig` reads the settings from the environment and the command line. |
| `src/app.ts` | `buildApp` makes the Fastify app: the CORS headers, the JSON error bodies, and `GET /healthz`. |
| `src/bus.ts` | `EventBus` delivers messages inside the process, by topic. |
| `src/clock.ts` | The time source of the runtime. |
| `src/main.ts` | Starts the server and closes it on `SIGTERM` and `SIGINT`. |
| `src/catalog/catalog.ts` | `readCatalogFile` reads a catalog file, and `indexCatalog` finds a product by its ID. |
| `catalog/catalog.dev.json` | The dev catalog with four products. The tests use its IDs and prices. |

The server has no session path and no device socket yet.

## Run it

Run `npm install` at the repository root first. Then run the commands in `apps/server`, or add `--workspace @glance/server` at the root.

```bash
npm run dev:fake    # port 8080, both fake switches on, needs no key and no database
npm run dev         # reads .env if the file exists, and restarts on a change
npm start           # runs with the environment of the shell
```

Check it:

```bash
curl http://localhost:8080/healthz
# {"ok":true,"fakeRecognition":true,"fakeSpeech":true,"store":"memory"}
```

## Settings

`.env.example` lists each variable. Copy it to `.env`. Git ignores `.env`, and the pre-commit hook stops a commit that holds one.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | The port. The server listens on each network interface. |
| `PUBLIC_BASE_URL` | `http://localhost:<PORT>` | The address that clients use. |
| `MONGODB_URI` | not set | With no address, the server keeps its data in memory. |
| `MONGODB_DB` | `glance` | The database name. |
| `CATALOG_PATH` | `catalog/catalog.dev.json` | The catalog file. |
| `GEMINI_API_KEY` | not set | Needed when `FAKE_RECOGNITION` is off. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | The recognition model. |
| `GEMINI_MEDIA_RESOLUTION` | `default` | `default` or `low`. |
| `RECOGNITION_MIN_CONFIDENCE` | `0.6` | A number from 0 to 1. |
| `FAKE_RECOGNITION` | off | `1` selects `fixtures/fake-script.json`. Each other value is the path of a script file. |
| `FAKE_SPEECH` | off | `1` means on. |
| `ELEVENLABS_API_KEY` | not set | Needed when `FAKE_SPEECH` is off. |
| `ELEVENLABS_VOICE_EN` | not set | Needed when `FAKE_SPEECH` is off. |
| `ELEVENLABS_VOICE_IT` | not set | The voice for Italian. |
| `SPEECH_CACHE_DIR` | `.cache/speech` | The folder for speech clips. |
| `SAVE_FRAMES` | not set | A directory for frames. Without it the server stores no frame. |
| `PAYMENT_DELAY_MS` | `1500` | The length of the mock payment. |

- An empty value counts as not set.
- The flag `--fake` turns both fake switches on. A variable that is set wins over the flag.
- Each path is relative to the working directory, which is `apps/server`.
- With a missing key the server prints `config: <message>` and exits with code 1. The message names the variable and the switch that removes the need.

## Catalog

A catalog file is a JSON array. Each entry is a `Product` of `@glance/shared`. Prices are integers in cents.

- `readCatalogFile` stops at the first entry that fails the schema. Its message names the file, the index of the entry, and the ID.
- `indexCatalog` rejects a catalog that holds one ID two times.
- In `allergens`, `null` means "no data", and an empty list means "no allergen". The potato crisps of the dev catalog have no data.

## Checks

```bash
npm test --workspace @glance/server                  # all tests
npm test --workspace @glance/server -- config        # the test files with "config" in the path
npm run typecheck --workspace @glance/server
npm run lint                                         # at the repository root, for each workspace
```

No test calls a vendor, and no test needs a key.
