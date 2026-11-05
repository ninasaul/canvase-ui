---
name: character-sheet
description: Build a consistent character sheet on the canvas — one anchor portrait plus turnaround views and detail crops, all sharing one identity paragraph. Use for 角色设定图 / 三视图 / 人物设定 / 角色一致性.
tags: canvas, character, consistency, image
---

# Character sheet

Use this skill when the user needs a character to stay **the same person** across
many images: "给这个角色出三视图", "做一份角色设定图", "人物要一致". The deliverable is a
small group of canvas nodes: one anchor portrait, a turnaround, and detail crops,
all generated from a single identity paragraph.

## 0. Read first

1. `canvas_get` — get `version` and existing nodes.
2. If a character node already exists (label such as `角色 · 某某`), reuse its prompt
   instead of writing a new identity.
3. Ask **only** what you truly cannot infer: gender, age range, outfit, art style.
   One short question, then proceed.

## 1. Write the identity paragraph (the anchor)

This paragraph is the single source of truth. Write it once, reuse it verbatim.

```
{姓名}，{年龄}岁，{发型+发色}，{脸型与五官特征}，{肤色}，
{上装}，{下装}，{鞋}，{标志性细节: 疤痕/纹身/饰品}
```

Rules:

- 6–9 attributes, concrete and visual. No personality words ("温柔" ✗ → "眼角下垂，浅笑" ✓).
- The signature detail (`标志性细节`) is mandatory: it is what keeps the character
  recognizable when the framing changes.
- Style words go in a **separate** line, never inside the identity paragraph.

## 2. Node plan

| node | prompt | 用途 |
| --- | --- | --- |
| `角色锚点` (image) | identity + 正面半身 + 中性光 + style | 参考基准 |
| `三视图` (image) | identity + 正面/侧面/背面全身并排 + 纯灰背景 | 结构参考 |
| `细节特写` (image) | identity + 面部大特写 + 侧逆光 | 细节校验 |
| `表情表` (image, optional) | identity + 4 格表情（平静/惊讶/生气/笑） | 表演参考 |
| `设定文本` (text) | the identity paragraph + style line | 下游引用源 |

## 3. Wiring

1. Create `设定文本` (text) with the identity paragraph.
2. Wire `设定文本` ──`prompt`──▶ every image node, so the identity is inherited.
3. Put `角色锚点` on the left; the other views to its right with 280px spacing.
4. Wire `角色锚点` ──`reference_image`──▶ `正面 / 侧面 / 背面` if the user wants separate
   single-view nodes instead of one turnaround image (ask if ambiguous).
5. Group them: `canvas_group_nodes` with label `角色 · {姓名}`.

## 4. Turnaround specifics

- Background: neutral grey `纯灰色背景，无阴影`, so crops are usable downstream.
- Same scale and same eye height across the three views.
- "并排" wording makes the model draw three figures in one frame; keep the aspect ratio
  wide (check `canvas_generation_options` for allowed sizes before setting params).
- Avoid perspective: `正交视角，无透视收缩`.

## 5. Detail crops

- Face: `面部大特写，皮肤纹理清晰，侧逆光，背景虚化`.
- Signature detail: `{细节}特写，浅景深，材质清晰`.
- Outfit: `服装局部特写，面料纹理`.

## 6. Confirm and run

Show the plan (which nodes, which prompt) and ask before running. Run with
`mode: "selected"` on the anchor first; only after it looks right, run the rest.

If the anchor is wrong, fix the identity paragraph and regenerate — never patch
individual views while the anchor is still wrong; that is how identity drifts.

## 7. Report

List the nodes created, the identity paragraph (so the user can reuse it), and
whether the group was created. Mention the version.

## Example

`references/example-character.md` shows a full sheet for one character.
