---
name: storyboard-from-script
description: Turn a script, outline or idea into a storyboard on the canvas — split shots, write a first-frame prompt per shot, wire the image chain, optionally add video nodes. Use for 剧本转分镜 / 拆镜头 / 做故事板 / 分镜脚本.
tags: canvas, storyboard, script, image, video
---

# Storyboard from a script

Use this skill when the user has a script, a scene description or just an idea
("把这段剧本拆成分镜", "给这个短视频做故事板", "拆成 6 个镜头"). The output is a canvas
where each shot is one image node with a precise first-frame prompt, laid out in
reading order, and optionally chained into video nodes.

## 0. Read the canvas first

1. `canvas_get` — you need `version`, existing nodes and their ids.
2. Decide: does the user want a **new** storyboard area, or to extend an existing chain?
   If unsure, ask once, briefly.
3. Do not delete anything in this flow unless the user asked.

## 1. Split the script into shots

A shot is **one camera setup**, not one sentence. For each shot record:

| field | rule |
| --- | --- |
| `shot` | sequential number, S01, S02 … |
| `action` | what happens on screen, 1 sentence |
| `shot size` | 远景 / 全景 / 中景 / 近景 / 特写 |
| `camera` | 机位与运动: 固定 / 推 / 拉 / 摇 / 跟 / 手持 / 俯拍 / 仰拍 |
| `light` | 光位与色温: 侧逆光 / 顶光 / 暖黄夜灯 / 冷蓝日光 |
| `duration` | 秒数, drives the video node later |
| `dialogue` | 台词（可为空） |

Keep 1 shot per 2–5 seconds of screen time. A 30-second piece is roughly 6–12 shots.
If the user asked for a specific count, honor it exactly.

Read `references/shot-vocabulary.md` if you need the full list of shot sizes,
camera moves and lighting phrases in Chinese.

## 2. Write the first-frame prompt per shot

Each image node gets one prompt that describes **a single frozen frame**:

```
{主体与动作}，{景别}，{镜头/视角}，{光线}，{环境与背景}，{风格/画质}
```

Rules:

- Describe the frame, never the motion ("她推开门走进来" → "她站在门口，手扶着半开的门").
- Keep the character description **identical** across shots (same hair, same coat) — consistency
  beats variety; copy the phrase verbatim.
- Put style words last and keep them identical across all shots of one board.
- No text overlays, no watermarks, no logos.
- One concept per prompt; if a prompt needs two "and", split the shot.

## 3. Build the graph

1. Create one **text** node holding the global style line (style + character sheet summary)
   and name it `风格锚点`.
2. For each shot create an **image** node with `prompt` = its first-frame prompt,
   `label` = `S01 · 中景`, and a position on a grid:
   `x = 0, y = shotIndex * 280`, or `x = shotIndex * 280` for a horizontal board.
3. Connect `风格锚点` ──`prompt`──▶ each image node so every shot inherits the same style.
4. If the user wants video too: per shot create a **video** node, wire
   image ──`first_frame`──▶ video, and put the motion prompt on the video node
   (`摄影机缓慢推近，人物眨眼，发丝轻微飘动`), plus `duration` in seconds.
5. Use one `canvas_add_node` call per node, then `canvas_connect` per edge. Pass
   `expectedVersion` from the previous response every time.

Batching tip: adding 10 nodes = 10 calls. That is fine — it is cheaper than one
giant rewrite because a failure only costs one node.

## 4. Confirm before spending

Before running anything, show the storyboard summary as a table
(shot / action / duration) and ask the user to confirm. Only call `canvas_run`
after they agree. Suggested mode:

- first pass: `mode: "selected"` with the image nodes (keeps cost low)
- videos afterwards, one shot at a time or in small batches

## 5. Report

After building, tell the user:

- how many shots and which pipeline was wired (image only, or image → video)
- where the board starts on the canvas
- what to run next, and that running costs credits

## Example

`references/example-30s.md` walks through a 30-second product spot end to end.
