---
name: canvas-graph-workflow
description: How to compose, edit and run Canvase canvas graphs safely — node types, edge roles, run modes, and version discipline.
description_zh: 画布建图、改图与运行的通用纪律
tags: canvas, graph, workflow, generation
---

# Canvas graph workflow

Use this skill for any task that builds or restructures a canvas: "把文本接成图片再出视频",
"拆成 4 个分镜", "给每个分镜加首帧".

## 1. Model of the graph

- **Nodes**: `text` | `image` | `video` | `audio` | `group`
  - `text` — static text, or a chat-generated text node (has `systemPrompt`)
  - `image` / `video` — generation result or imported asset; `data.url` = full media,
    `data.thumbnailUrl` = preview, `data.assetId` = MediaAsset id
  - `audio` — imported or generated audio
  - `group` — parent node; children use `parentId` with positions relative to the group
- **Edges** carry a role. The role decides what the target sees:

| role | meaning |
| --- | --- |
| `prompt` | text node contributes prompt text |
| `context` | text node contributes extra context |
| `reference_image` | image used as a style/content reference |
| `first_frame` / `last_frame` | image anchors for video generation |
| `reference_video` / `reference_audio` | media references |

Never attach an image edge to a `text` node, or a text edge into a media node's `in` handle —
the editor rejects those connections and the tool returns an error.

## 2. Standard pipelines

- **text → image**: text node ──`prompt`──▶ image node
- **image → video**: image node ──`first_frame`──▶ video node (+ prompt text)
- **multi-reference**: 2–4 image nodes ──`reference_image`──▶ one image/video node
- **storyboard**: one text node ──`prompt`──▶ N image nodes, then each image ──`first_frame`──▶ video

## 3. Editing discipline

1. `canvas_get` first — you need `version` and real node ids.
2. Every write tool takes `expectedVersion`. Pass the version you just read.
3. On a `409` / version conflict: `canvas_get` again, re-apply the change, retry once.
4. Prefer several small edits over one giant graph rewrite; they are easier for the user
   to undo and cheaper to retry.
5. Place new nodes near their inputs (`position`), and let the user run auto-layout later.
   Leave ~40px gaps; default node sizes are 240×242 (image), 280×160 (video), 220×120 (text).

## 4. Running

- `canvas_run` with `mode`:
  - `all` — every executable node
  - `selected` — the given nodes plus their ancestors
  - `from` — the given nodes plus their descendants
  - `retry-failed` — failed/cancelled nodes and everything downstream
- Only `image` and `video` nodes execute; `text` is a static input unless the user explicitly
  asks to generate it.
- Runs are asynchronous. Use `canvas_run_status` with the returned `runId`; do not poll faster
  than every few seconds. `canvas_run_cancel` stops nodes that have not started.

## 5. Media rules

- Do not invent asset URLs. Only use URLs the user gave you or that exist on nodes.
- After a successful run, nodes get real `url` / `assetId` — read them back with `canvas_get`
  instead of guessing.

## 6. Reporting

Tell the user what changed in plain language: how many nodes added, which pipeline was wired,
whether a run was started. Mention the version if they are collaborating with another client.
