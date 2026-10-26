# FitCheck

FitCheck gives you a second opinion while you are shopping for clothes. Scan a garment with your phone camera or paste a shop link, and it answers BUY, SKIP, or TRY-WITH based on what is already in your closet, the 7-day forecast, and your calendar. It can also show the garment on you.

FitCheck was built at the Hacktoberfest mini hackathon run by Technica, Bitcamp, and Hack4Impact UMD, where it won the open source track.

## Example

The engine ships a CLI that prints JSON. With no configuration it runs fully offline on fakes and fixtures:

```bash
cd engine
uv sync --all-extras
uv run fitcheck health      # which adapter fills each slot
uv run fitcheck judge --tags '{"category":"outerwear","color_family":"navy","pattern":"solid","warmth":4,"waterproof":true,"formality":2,"description":"navy rain shell"}'
uv run fitcheck week        # forecast and calendar for the coming days
```

`judge` returns a decision (`buy`, `skip`, or `try_with`) along with the reasons behind it, such as `duplicates`, `fills_weather_gap`, `fits_event`, `pairs_well`, `few_pairings`, or `statement_piece`. Run `uv run fitcheck --help` to see the other commands: `serve`, `scan`, `chat`, `render`, `closet`, `add`, `forget`, `seed`, and `openapi`.

## Features

- Garment tagging from a photo or a product link. An open-weight vision model behind any OpenAI-compatible API does the tagging (default `Qwen/Qwen3-VL-8B-Instruct` on Featherless). A color-only fake is used when none is configured.
- Deterministic verdict rules in `engine/src/fitcheck/verdict/` that compare the candidate with your closet (duplicates and pairings), wet and cold days in the forecast, and calendar events
- A stylist chat that explains the verdict. It uses a template by default, or an OpenAI-compatible chat model, or Snowflake Cortex.
- Try-on in several ways: a flat overlay, the Leffa Hugging Face Space, or a self-hosted worker. The web app can also do a live on-camera preview with MediaPipe pose tracking in the browser.
- Closet storage in SQLite (default), in memory, in Postgres, or in Snowflake
- A mobile-first web app (Vite and React) that talks to the engine through a typed OpenAPI client

## Tech stack

- Engine: Python 3.12+, FastAPI, Pydantic, httpx, Pillow, managed with uv. Optional extras: psycopg, snowflake-connector, rembg/onnxruntime, gradio-client, icalendar.
- Web: React 19, TypeScript, Vite, `@mediapipe/tasks-vision`, `openapi-fetch`
- Worker: FastAPI service with an `echo` backend only
- Data: SQLite, Postgres (pgvector image via `docker-compose.yml`), or Snowflake (`engine/sql/snowflake/`)
- Context: Open-Meteo for weather, iCal (`.ics`) URLs for calendars

## Getting started

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js 20.19 or newer, and `make`. Docker is only needed for Postgres.

```bash
make sync          # engine dependencies, every adapter extra
make web-install   # web app dependencies
make dev           # engine on :8000, web app on https://localhost:5173
```

The dev server uses a self-signed certificate, so accept the browser warning once. A phone on the same Wi-Fi can open the `Network:` URL that Vite prints. The camera needs HTTPS. Run `make help` to see every target.

Out of the box the engine keeps closets in SQLite under `.fitcheck/`, uses a fake tagger, a fixture week, the template stylist, and the flat overlay for try-on. The closet starts empty.

### Configuration

Every setting is a field in `engine/src/fitcheck/settings.py`, read from a `FITCHECK_<FIELD>` environment variable or from `engine/.env` (git-ignored). Main switches:

- Adapters: `FITCHECK_STORE`, `FITCHECK_TAGGER`, `FITCHECK_CUTOUT`, `FITCHECK_TRYON`, `FITCHECK_TRYON_FALLBACK`, `FITCHECK_WEATHER`, `FITCHECK_CALENDAR`, `FITCHECK_STYLIST`
- Models: `FITCHECK_VISION_BASE_URL`, `FITCHECK_VISION_API_KEY`, `FITCHECK_VISION_MODEL`, `FITCHECK_CHAT_BASE_URL`, `FITCHECK_CHAT_API_KEY`, `FITCHECK_CHAT_MODEL`
- Try-on: `HF_TOKEN`, `FITCHECK_TRYON_WORKER_URL`, `FITCHECK_TRYON_WORKER_TOKEN`
- Other: `FITCHECK_DATABASE_URL`, `FITCHECK_CALENDAR_ICS_URL`, `FITCHECK_SNOWFLAKE_ACCOUNT`, `FITCHECK_SNOWFLAKE_USER`, `FITCHECK_SNOWFLAKE_PASSWORD` or `FITCHECK_SNOWFLAKE_PRIVATE_KEY_PATH`
- Web: `FITCHECK_ENGINE_URL` (dev proxy target), `VITE_API_BASE`, `FITCHECK_HTTP=1` (plain HTTP behind a tunnel)

Two presets in `env/` pick adapters for you:

```bash
make db-up           # Postgres in Docker, for the open path
make api-open        # open-weight models, Postgres, Leffa try-on (env/open.env)
make api-snowflake   # Snowflake store and Cortex stylist (env/snowflake.env)
```

Point the model base URLs at your own Ollama or vLLM server to keep inference local. `make ollama-pull` fetches the tagger model.

### Checks

```bash
cd engine && uv run ruff check src && uv run ruff format --check src && uv run mypy src
cd web && npm run typecheck && npm run build
```

The engine's `tests/` directory is not included in this copy of the repo. Until it is, `make test` and `make check` have no tests to run.

## How it works

```
photo / shop link -> tagger (vision model) -> GarmentTags
GarmentTags + closet + week (weather, calendar) -> verdict rules -> BUY / SKIP / TRY-WITH + reasons
                                                 -> stylist chat, try-on render
```

- `engine/src/fitcheck/domain.py`: core types (`GarmentTags`, `Garment`, `Verdict`, `ReasonCode`)
- `engine/src/fitcheck/verdict/`: the decision rules. Thresholds such as duplicate count, wet-day rain amount, and cold-day temperature are constants at the top of the file.
- `engine/src/fitcheck/ports.py` and `wiring.py`: one interface per slot, plus the code that picks an adapter from settings
- Adapter packages: `closet/`, `vision/`, `tryon/`, `context/` (weather and calendar), `stylist/`
- `engine/src/fitcheck/api/app.py`: HTTP routes (`/scan`, `/link`, `/judge`, `/week/{owner}`, `/render`, `/chat`, `/closet/{owner}`, `/health`)
- `engine/src/fitcheck/cli.py`: the `fitcheck` command
- `web/src/`: `screens/` (Welcome, Home camera, Result, Live, You, Closet), `state/`, `api/client.ts` (typed from `web/openapi.json`), and `lib/` (camera, pose, cutout, compositing)
- `worker/`: the try-on service that `FITCHECK_TRYON=remote` calls (`GET /health`, `POST /render`)

After you change an engine route, run `make openapi` and then `npm run gen:api` in `web/` to regenerate the client types.

## Project structure

```
engine/     Python engine: verdict rules, adapters, HTTP API, CLI
web/        Mobile-first web app (Vite, React, TypeScript)
worker/     Try-on worker service (echo backend)
env/        Adapter presets for the open and Snowflake paths
docker-compose.yml   Postgres (pgvector image) for FITCHECK_STORE=postgres
Makefile    Entry points for every task; run `make help`
```

## Contributing

Issues and pull requests are welcome. Before you open a PR, run the checks above. If you changed an API route, also regenerate `web/openapi.json` and the client types.

## License

Apache 2.0. See [LICENSE](LICENSE). Models, data, and services that FitCheck calls keep their own licenses.
