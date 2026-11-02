# @canvase/mcp

stdio [MCP](https://modelcontextprotocol.io/) server that forwards canvas tools to a Canvase host. Intended for Codex / Claude Desktop / Cursor and similar MCP hosts.

The server is a thin client: every tool call is an authenticated HTTP request to the Canvase app (`/api/agent/tools/...`). Graph edits and runs happen on the server; the MCP process does not open the database or Redis itself.

## Prerequisites

- A running Canvase app (`pnpm dev` or production)
- An agent token from the canvas **Connect Agent** dialog (scopes at least `canvas:read`; edit/run need matching scopes)
- Node.js 20+ (run from the monorepo root so `./packages/canvase-mcp/src/cli.js` resolves)

Optional for generation runs and thumbnails:

- User (or env) generation gateway configured in Model settings
- Redis + `pnpm worker` if you want async `thumbnailUrl` generation after uploads / runs

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `CANVASE_BASE_URL` | yes | App origin, no trailing slash (e.g. `http://localhost:3917`) |
| `CANVASE_TOKEN` | yes | Agent token (`cvs_...`) shown once when issued |
| `CANVASE_CANVAS_ID` | yes | Target canvas id (token is also bound to this canvas) |

## Install / run

No separate publish step: use the package in this monorepo.

```bash
# from canvase-ui repo root
node ./packages/canvase-mcp/src/cli.js
```

Or via package bin after `pnpm install` at the root:

```bash
pnpm --filter @canvase/mcp start
```

## Codex / MCP host config

From the Canvase **Connect Agent** dialog, copy the generated `mcpServers` snippet, or:

```json
{
  "mcpServers": {
    "canvase-canvas": {
      "command": "node",
      "args": ["./packages/canvase-mcp/src/cli.js"],
      "env": {
        "CANVASE_BASE_URL": "http://localhost:3917",
        "CANVASE_TOKEN": "cvs_...",
        "CANVASE_CANVAS_ID": "canvas_id"
      }
    }
  }
}
```

Run the MCP host with **cwd = canvase-ui monorepo root** so the `args` path works. Absolute paths also work if you prefer.

Token is shown only once at issue time; revoke unused tokens in the same dialog.

## Scopes

Default Connect Agent issue includes:

| Scope | Tools |
| --- | --- |
| `canvas:read` | `canvas_get`, `canvas_get_node`, `canvas_search_nodes`, `skills_list`, `skills_read` |
| `canvas:edit` | add / update / delete / connect / disconnect / set_selection |
| `canvas:run` | `canvas_run`, `canvas_run_status`, `canvas_run_cancel` |

Missing scope returns HTTP 403 from the tool gateway.

## Tools

### Graph (read)

| Tool | Notes |
| --- | --- |
| `canvas_get` | Summary: title, version, nodes, edges, selection, viewport |
| `canvas_get_node` | One node plus incoming / outgoing edges |
| `canvas_search_nodes` | Filter by `type` and/or `labelIncludes` |

Image/video summaries include `url`, `thumbnailUrl`, and `assetId` when available. Missing `thumbnailUrl` is hydrated from owned `MediaAsset` via `assetId` / `assetIds` (read path does not bump canvas version).

### Graph (edit)

| Tool | Notes |
| --- | --- |
| `canvas_add_node` | `type`, optional `position` / `data` / size / `id` |
| `canvas_update_node` | Patch `data`, position, or size |
| `canvas_delete_nodes` | Deletes nodes and connected edges |
| `canvas_connect` | Typed edge role between two nodes |
| `canvas_disconnect` | By `edgeId` or `source`+`target`(+`role`) |
| `canvas_set_selection` | Logical selection used by run modes |
| `canvas_group_nodes` | Wrap root nodes in a group (bbox computed server-side) |
| `canvas_ungroup` | Dissolve a group, children return to absolute positions |

All edit tools require `expectedVersion` from the latest `canvas_get` (optimistic concurrency). On conflict the host returns 409 — refresh with `canvas_get` and retry.

For image/video nodes, `data` may include:

- `url` — full media URL
- `thumbnailUrl` — smaller preview (editor prefers this over `url`)
- `assetId` / `assetIds` — local `MediaAsset` ids (used for thumbnail hydration / enqueue)

If you pass `assetId` without `thumbnailUrl`, the gateway fills `thumbnailUrl` when the asset already has one, otherwise enqueues a thumbnail job.

### Generation params (`canvas:read` / `canvas:edit`)

| Tool | Notes |
| --- | --- |
| `canvas_generation_options` | Allowed sizes / aspect ratios / quality (image), ratios / resolutions / duration (video), plus current values |

Pass params through `canvas_update_node`'s `data.params`; keys are **merged**, so partial updates keep the rest.

### Generation (`canvas:run`)

| Tool | Notes |
| --- | --- |
| `canvas_run` | `mode`: `all` \| `selected` \| `node` \| `from` \| `retry-failed`; `nodeIds` required for `selected` / `node` / `from` (a group id expands to its children) |
| `canvas_run_status` | By `runId`, or latest run on this canvas |
| `canvas_run_cancel` | Cancel queued / running agent run |

Runs use the canvas owner's generation connection (BYOK / server env). Node status is written into the graph and mirrored for the editor (running overlays / Running Tasks).

After a successful image/video node, if the output `MediaAsset` already has a thumbnail it is written onto the node; otherwise a BullMQ thumbnail job is enqueued (non-blocking). Keep `pnpm worker` running locally for previews to appear.

## Typical agent loop

1. `canvas_get` — read `version` and node list
2. Edit graph (`canvas_add_node` / `canvas_connect` / …) with `expectedVersion`
3. Use the `version` returned by each edit as the next `expectedVersion`
4. `canvas_run` with an appropriate mode
5. Poll `canvas_run_status` until terminal; cancel with `canvas_run_cancel` if needed

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| MCP process exits immediately | Missing / empty env vars |
| 401 on tools | Token revoked, expired, or wrong `CANVASE_TOKEN` |
| 403 Missing scope | Token issued without the required scope |
| 404 Canvas not found | Wrong `CANVASE_CANVAS_ID` or canvas archived |
| 404 Unknown skill | `skills_read` name not found; run `skills_list` |
| 409 Version conflict | Stale `expectedVersion`; call `canvas_get` again |
| Run fails generation | Owner has no usable Base URL / API key |
| Nodes show full-size images only | Thumbnail worker not running, or asset has no `assetId` / broken source URL |

## Skills

`skills_list` and `skills_read` expose instruction packs hosted by the Canvase app
(`./skills/<id>/SKILL.md`, or `CANVASE_SKILLS_DIR`). Read-only, available with `canvas:read`.

- `skills_list` → `{ count, skills: [{ id, name, description, tags }] }`
- `skills_read({ name })` → `{ id, name, description, tags, files, content }`
- `skills_read({ name, file })` → same shape with one resource file's `content`

Reads are confined to the skill folder; `..`, absolute paths, and non-text files are rejected.

## Related

- Host app overview: repository root [`README.md`](../../README.md)
- Connect Agent UI: open a canvas → **Connect Agent**
