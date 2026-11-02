# Worked example: 3-shot storyboard

Goal: one prompt → three keyframes → three 5s videos.

```
text("storyboard: 三个镜头，夜景街道，霓虹雨")
  ├─prompt──────────▶ image#1 ──first_frame──▶ video#1
  ├─prompt──────────▶ image#2 ──first_frame──▶ video#2
  └─prompt──────────▶ image#3 ──first_frame──▶ video#3
```

## Tool sequence

1. `canvas_get` → note `version`, existing node ids.
2. `canvas_add_node` ×3 (`type: "image"`, distinct `prompt` per shot) → each response bumps `version`.
3. `canvas_add_node` ×3 (`type: "video"`, `data.params.duration = "5"`).
4. `canvas_connect` text → each image with `role: "prompt"`.
5. `canvas_connect` each image → its video with `role: "first_frame"`.
6. `canvas_run` with `mode: "all"`, then `canvas_run_status` every ~5s.

## Pitfalls

- Reusing a stale `expectedVersion` after any write returns `409` — re-read and retry.
- Video nodes without a `first_frame` are text-to-video; that is usually slower and less
  consistent across shots. Prefer anchoring on the image.
- Three images + three videos is six billable generations; confirm with the user first when
  the canvas already has results.
