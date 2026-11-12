**English** · [简体中文](README.zh-CN.md)

# VEME

Open-source AI media workflow canvas ([veme.dev](https://veme.dev)). Compose image, video, and text generation as a node graph, run DAGs locally, and store media in your own S3-compatible bucket.

Auth uses [Better Auth](https://www.better-auth.com/) (email/password). Canvas and media metadata live in PostgreSQL via Prisma.

## Highlights

- Visual canvas editor (React Flow) with image / video / text / audio nodes
- Bring-your-own gateway: OpenAI-compatible Base URL + model list (BYOK profiles, including unlimited custom gateways)
- Same-origin `/v1` proxy injects an optional server-side `GENERATION_API_KEY` — keys are not stored in the browser
- Media library via browser **presigned PUT** to R2 / S3 / MinIO
- Canvas cover + list previews; async WebP thumbnails via a BullMQ worker (sharp / ffmpeg)
- **Connect Agent**: scoped tokens + HTTP tool gateway + `@canvase/mcp` (stdio) for Codex / other MCP hosts — graph edit and server-side `canvas_run`
- i18n (zh / en), theme toggle, canvas preferences

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16, React 19, Tailwind CSS 4 |
| Auth | Better Auth |
| Data | Prisma 7, PostgreSQL |
| Queue | BullMQ + Redis (thumbnail worker) |
| Storage | AWS SDK → S3-compatible object storage |

## Requirements

- Node.js 20+ and [pnpm](https://pnpm.io/) 11
- PostgreSQL 16+
- Redis 7+ (for the thumbnail worker)
- Optional: `ffmpeg` on `PATH` (or `FFMPEG_PATH`) for video posters

## Quick start

```bash
cp .env.example .env
# Edit DATABASE_URL, BETTER_AUTH_SECRET, and optional S3_*/GENERATION_* vars

# Postgres only (Redis: use a local install, see REDIS_URL)
docker compose up -d

# Align DATABASE_URL with compose if needed, e.g.
# postgresql://canvase:canvase@localhost:5432/canvase?schema=public

pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3917](http://localhost:3917), register, then create a canvas.

`pnpm dev` starts **everything**: the Next.js server (port 3917) and the asset thumbnail
worker, with `[app]` / `[worker]` prefixed logs. Redis must be running for thumbnails
(`REDIS_URL`, default `redis://127.0.0.1:6379/1`); if it is down the app still starts and
the launcher prints a warning.

Need only one of them?

```bash
pnpm dev:app      # Next.js only
pnpm dev:worker   # thumbnail worker only
```

## Configuration

See [`.env.example`](.env.example). Important variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Auth secrets and public app URL |
| `NEXT_PUBLIC_APP_URL` | Public origin (CORS allowlist helper, links) |
| `GENERATION_BASE_URL` | Default OpenAI-compatible gateway (UI can override per user) |
| `GENERATION_API_KEY` | Optional server-side Bearer for `/v1` proxy |
| `S3_*` | Fallback object storage (user **Settings → Storage** overrides env) |
| `STORAGE_SECRET` | Encrypts user-stored S3 / generation secrets (defaults to `BETTER_AUTH_SECRET`) |
| `REDIS_URL` | BullMQ connection for the thumbnail worker |
| `FFMPEG_PATH` | Optional path to ffmpeg |

### Generation / models

Configure gateways and models in the canvas **Model settings** UI (Base URL, encrypted API keys for BYOK profiles, model pull / manual rows). The browser never sends vendor keys to third parties directly for generation: requests go through this app’s `/v1` proxy.

### Object storage

Uploads use **presign → browser PUT → complete**. Credentials stay on the server (encrypted user config or env).

Bucket **CORS** must allow `PUT` (and typically `GET` / `HEAD`) from your app origin, e.g. `http://localhost:3917`. Without CORS, the client shows a network / CORS upload error even when server credentials are valid.

Examples:

```bash
# Cloudflare R2 (endpoint = account host only; bucket is separate)
S3_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="canvase-media"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://cdn.example.com"
S3_FORCE_PATH_STYLE="true"

# MinIO (local)
S3_ENDPOINT="http://127.0.0.1:9000"
S3_REGION="us-east-1"
S3_BUCKET="canvase-media"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_PUBLIC_BASE_URL="http://127.0.0.1:9000/canvase-media"
S3_FORCE_PATH_STYLE="true"

# AWS S3
S3_ENDPOINT="https://s3.ap-southeast-1.amazonaws.com"
S3_REGION="ap-southeast-1"
S3_BUCKET="canvase-media"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://canvase-media.s3.ap-southeast-1.amazonaws.com"
S3_FORCE_PATH_STYLE="false"
```

### Thumbnails

After an asset is marked `ready`, the API enqueues a job on Redis (`asset-thumbnails`). The worker:

1. Downloads the public object (or captures a video frame with ffmpeg)
2. Encodes a WebP (max edge 480) with sharp
3. Uploads `{assetId}-thumbnail.webp` and updates `MediaAsset.thumbnailUrl` / size fields

Canvas cover uploads (`purpose=canvas_thumbnail`) are skipped by the worker. Until a thumbnail exists, UIs fall back to the original `url`.

Editor image nodes prefer `node.data.thumbnailUrl` over `url`. On canvas load (and MCP read tools), missing `thumbnailUrl` is hydrated from `MediaAsset` when `assetId` / `assetIds` are present. After agent `canvas_run`, the server writes `thumbnailUrl` if the asset already has one, otherwise enqueues a job.

## Authentication

Email + password through Better Auth. The forms validate on submit (email shape, 8-character minimum), surface field-level errors, map upstream messages to localized copy, and keep the `?next=` target so a deep link survives the login detour (only same-origin paths are accepted).

Server-side: passwords are limited to 8–128 characters, sessions last 30 days and refresh daily, and the credential endpoints are rate limited (10 sign-ins per minute, 5 sign-ups per 5 minutes). Theme follows the OS until the user picks one.

## Connect Agent (MCP)

Agents can edit and run a single canvas through scoped tokens.

1. Open a canvas → **Connect Agent**
2. Issue a token (default scopes: `canvas:read`, `canvas:edit`, `canvas:run`)
3. Copy the MCP config snippet into Codex / your MCP host
4. Keep cwd at the monorepo root (or use absolute paths to `packages/canvase-mcp`)

| Piece | Role |
| --- | --- |
| Agent token | Bound to one canvas + scopes; shown once; revocable |
| Tool gateway | `/api/agent/tools` (+ `/api/agent/tools/[toolName]`) |
| `@canvase/mcp` | stdio MCP server; forwards tool calls to the gateway |
| Runs | Server-side DAG via `canvas_run` / status / cancel; editor polls active runs for node overlays |
| Grouping | `canvas_group_nodes` / `canvas_ungroup`; node summaries expose `parentId` + group `childIds` |
| Params | `canvas_generation_options` lists model-allowed values; `canvas_update_node` merges `data.params` |

Agent chat turns are persisted server-side (`canvas_chat_message`, append-only, last 400 per canvas) so history survives reloads and devices. Messages carry a `sessionId`: **New conversation** starts a fresh model context, while earlier sessions stay visible in the same timeline behind a divider. The editor keeps a local cache for instant paint; the server transcript wins when available. `GET/DELETE /api/canvases/[id]/chat` reads or clears it.

### Agent approvals

Read and ordinary edit tools run automatically (they are undoable). Tools that cost money or delete in bulk do not: `canvas_run` and `canvas_delete_nodes` with more than five ids block the turn and emit an `approval_request` over the chat stream. The browser answers through `POST /api/agent/approvals/[id]` with `allow_once`, `allow_session` (30 minute grant for that conversation) or `deny`; a denial is fed back to the model as a tool result so it can propose a smaller step. Pending approvals and their session grants are shared through Redis (`canvase:approval:<id>` + a `canvase:approval:decision` pub/sub channel), so any instance can answer a turn running elsewhere. Without `REDIS_URL` both fall back to process-local state, which only works for a single instance.

### Memory compaction

Long conversations are folded rather than truncated: before a turn whose transcript exceeds the window, the client sends the oldest slice to `POST /api/agent/summarize`, the model writes a dense briefing, and the result is stored in `canvas_chat_summary` (`coveredThrough` records the timestamp the summary reaches, so pruning or clearing cannot mis-place the cut). Later turns send that briefing plus the recent tail instead of the whole history, and the summary survives reloads and devices. When a second compaction runs, the previous summary is folded into the new one so nothing is lost between slices.

### Large canvases

Big graphs stay interactive (verified on a 164-node / 203-edge canvas):

- edge flow animation is capped at 80 edges — each animated edge repaints every frame
- level of detail: below 35% zoom node media stops mounting and text renders as a static preview; edge role labels only mount above 50% zoom. Both switch on gesture end, not per frame
- node components look up their node through a cached index instead of `nodes.find` (O(n²) → O(n) per update), and viewport-derived state updates when a pan/zoom gesture ends
- each node is a paint/layout containment boundary and the viewport layer is promoted, so dragging and panning composite instead of repainting the graph

Measured on that canvas: idle slow frames 9 → 0, node drag 27.9ms → 8.4ms average, pan 19.9ms → 8.5ms.

### Run cards and history budget

Agent-triggered `canvas_run` renders as a live card in the transcript (mode, `done/total`, failures, cancel) that polls `GET /api/canvases/[id]/runs/[runId]` every two seconds until the run settles. Chat history sent to the model is capped by characters (`MAX_API_HISTORY_CHARS`, 120k) rather than messages alone: tool notes are truncated to 420 characters and the oldest turns collapse into an `[earlier conversation omitted]` note, while the last six messages always stay verbatim.

### Steering

While a turn is streaming the composer stays editable: the send button becomes **Steer** and the message is queued instead of starting a new turn. The instruction is folded into the conversation as `[mid-turn instruction from the user] …` right before the agent's next step (and once more before the turn ends, so guidance that arrives during the final stream still gets answered). The endpoint is `POST /api/agent/steer`; a `409` means nothing was streaming, and the client falls back to a normal message. Queued instructions are persisted to the transcript, so history stays honest.

### Canvas context

Every chat turn carries `context { version, selection, focusNodeId, visibleNodeIds }` from the editor. The server rebuilds a short canvas digest from the database (title, version, node/group counts, failures, groups, the user's selection, focus node, viewport ids, version drift) and injects it into the system prompt, so the agent no longer has to call `canvas_get` just to learn node ids. The composer shows the current selection as removable chips, and a tool call that targets a node flashes it on the canvas and pans it into view.

Edit tools use optimistic concurrency (`expectedVersion` from `canvas_get`). Details, tool list, and troubleshooting: [`packages/canvase-mcp/README.md`](packages/canvase-mcp/README.md).

## Agent skills

Skills are reusable instruction packs the agent loads on demand (progressive disclosure):
only `name` + `description` go into the prompt, and the full text is fetched with a tool.

```
skills/
  canvas-graph-workflow/
    SKILL.md                    # YAML frontmatter + instructions
    references/example.md       # optional resources, read on demand
```

`SKILL.md` frontmatter:

```markdown
---
name: canvas-graph-workflow
description: How to compose, edit and run VEME canvas graphs safely.
tags: canvas, graph
---
```

| Piece | Role |
| --- | --- |
| Discovery | `skills_list` → `{ id, name, description, tags }` |
| Loading | `skills_read({ name })` → full body + sibling `files`; `skills_read({ name, file })` for a resource |
| Prompt | The catalog is appended to the canvas-agent system prompt; chat and MCP share the same tools |
| Scope | Read-only; any actor with `canvas:read` may use them |
| Location | `./skills` by default, override with `CANVASE_SKILLS_DIR` |

Folder names must match `^[a-z0-9][a-z0-9._-]*$`. Reads are confined to the skill folder
(no `..`, no absolute paths, text files only, 256 KB per file). Calls are audited in
`canvas_command_log`. Four skills ship built in (`canvas-graph-workflow`, `storyboard-from-script`, `character-sheet`, `image-to-video`); browse them in **Settings → Skills**, or type `/` in the composer to pick one and run it immediately. Drop in a folder with a `SKILL.md` — no restart needed (5s cache).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` / `pnpm dev:all` | Next.js (3917) **+** thumbnail worker, one command |
| `pnpm dev:app` / `pnpm dev:worker` | Run just one side of the dev stack |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create / apply Prisma migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm worker` / `pnpm worker:dev` | Asset thumbnail worker (requires Redis) |
| `pnpm --filter @canvase/mcp start` | stdio MCP server (needs `CANVASE_*` env; see package README) |

## What this repo is

A self-hosted canvas UI with a small BFF. It is intentionally a single-tenant deployment:

- Gateways and model catalogs are configured per user in the canvas; a shared `GENERATION_API_KEY` can still be injected through the environment
- Storage is per-user or environment-level S3/R2
- Thumbnails are generated by one local BullMQ worker, not a worker fleet

## License

[MIT](LICENSE)
