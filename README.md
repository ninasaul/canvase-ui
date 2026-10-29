# Canvase

Open-source AI media workflow canvas. Compose image, video, and text generation as a node graph, run DAGs locally, and store media in your own S3-compatible bucket.

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

# Postgres + Redis
docker compose up -d

# Align DATABASE_URL with compose if needed, e.g.
# postgresql://canvase:canvase@localhost:5432/canvase?schema=public

pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), register, then create a canvas.

In a second terminal (thumbnails for new uploads):

```bash
# REDIS_URL=redis://127.0.0.1:6379
pnpm worker:dev
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

Bucket **CORS** must allow `PUT` (and typically `GET` / `HEAD`) from your app origin, e.g. `http://localhost:3000`. Without CORS, the client shows a network / CORS upload error even when server credentials are valid.

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

Edit tools use optimistic concurrency (`expectedVersion` from `canvas_get`). Details, tool list, and troubleshooting: [`packages/canvase-mcp/README.md`](packages/canvase-mcp/README.md).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create / apply Prisma migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm worker` / `pnpm worker:dev` | Asset thumbnail worker (requires Redis) |
| `pnpm --filter @canvase/mcp start` | stdio MCP server (needs `CANVASE_*` env; see package README) |

## Open source vs hosted (tu_api)

This repo is a self-hosted UI + light BFF. Compared with the hosted product:

- Users configure gateways and model catalogs in the canvas; server env can still inject a shared `GENERATION_API_KEY`
- Storage is per-user or env-level S3/R2, not multi-tenant control plane
- Thumbnail generation is a local BullMQ worker rather than a full multi-queue worker fleet

## License

Private / unlicensed unless otherwise stated in the repository.
