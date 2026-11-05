---
name: image-to-video
description: Animate a still image on the canvas — pick the anchor frame, write motion prompts that respect the frame, set duration and ratio, then run. Use for 图生视频 / 让这张图动起来 / 首帧动画 / 运镜.
description_zh: 图生视频：首帧、运镜、时长与比例
tags: canvas, video, animation, image
---

# Image to video

Use this skill when the user has one or more images and wants motion:
"让这张图动起来", "做个 5 秒的运镜", "图生视频". The result is a video node wired from an
image node through the `first_frame` role.

## 0. Read first

1. `canvas_get` — find the image node(s). You need `url` (must be a real asset,
   not empty) and the node id.
2. If the image node has no `url`, stop and tell the user to generate or upload it first.
   Never invent a URL.
3. `canvas_generation_options` on an existing video node (or ask) to learn the allowed
   ratios, resolutions and durations for the video model — do this **before** setting params.

## 1. Write the motion prompt

A video prompt has two parts: **what moves** and **how the camera moves**.

```
{主体动作}，{摄影机运动}，{时间内的起止状态}
```

Rules:

- Only describe motion that is plausible from the still frame. If the frame shows a
  closed door, do not make it open unless the user asks.
- Keep the subject identity fixed: do not re-describe the character, the frame already has it.
- One camera move per clip. "推近 + 环绕 + 摇" produces mush.
- Give the clip an end state: `最后停在手部特写上`.
- Ambient motion sells realism cheaply: 发丝微动、烟雾缓慢上升、光斑轻微闪动.

Read `references/motion-vocabulary.md` for the phrase list.

## 2. Wiring

1. Ensure the image node is complete (`status: succeeded`, has `url`).
2. Create the video node with `prompt` = motion prompt, `label` = `视频 · S0X`.
3. Wire image ──`first_frame`──▶ video. This role matters: with `reference_image`
   the model treats it as style, not as the starting frame.
4. Set `data.params`: `duration` (seconds), `ratio`, `resolution` — only values returned by
   `canvas_generation_options`. Partial updates merge, so send only what changes.
5. Position the video node directly to the right of its image node.

## 3. Duration and ratio

| 用途 | 时长 | 比例 |
| --- | --- | --- |
| 循环素材 / 氛围 | 4–5s | 与原图一致 |
| 单镜头叙事 | 5–8s | 与原图一致 |
| 竖屏短视频 | 5s | 9:16 |
| 横屏广告 | 5–10s | 16:9 |

Match the image aspect ratio unless the user asks otherwise — changes crop the frame and
can cut the subject. When you must change it, tell the user what will be cropped.

## 4. Confirm and run

Show the plan (which image, motion prompt, duration, ratio) and ask before running.
Runs cost credits. Then `canvas_run` with `mode: "node"` and the video node id — the
upstream image is already generated, so there is no need to re-run it.

`node` mode skips ancestors on purpose; that is what you want here.

## 5. Check the result

Use `canvas_run_status` with the returned `runId` every few seconds, not in a tight loop.
On failure, read `data.error` via `canvas_get`:

| error | next step |
| --- | --- |
| 内容审核 | rewrite the motion prompt, drop risky words |
| 时长/比例不支持 | re-read `canvas_generation_options` and fix params |
| 首帧缺失 | the image node has no `url`; regenerate the image |

## 6. Report

Tell the user which image was animated, the prompt used, the duration and ratio, and
whether the video succeeded. If it failed, give the reason in one line and the fix.
