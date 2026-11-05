# Worked example — character sheet

## Identity paragraph

```
林夏，25 岁，短发染薄雾蓝，右眉尾有一道细疤，杏仁眼，冷白皮，
米色风衣，白色帆布鞋，左手腕戴着旧银表
```

Style line (kept separate):

```
写实电影感，35mm 胶片颗粒，柔和自然光
```

## Node plan

| node | label | prompt 摘要 |
| --- | --- | --- |
| text | 设定文本 | identity + style line |
| image | 角色锚点 | identity，正面半身，中性柔光，浅灰背景 |
| image | 三视图 | identity，正面/侧面/背面全身并排，纯灰背景，正交视角 |
| image | 面部特写 | identity，面部大特写，侧逆光，背景虚化 |
| image | 细节特写 | 左手腕旧银表特写，浅景深，金属划痕清晰 |

## Wiring

```
设定文本 ──prompt──▶ 角色锚点
        ──prompt──▶ 三视图
        ──prompt──▶ 面部特写
        ──prompt──▶ 细节特写
角色锚点 ──reference_image──▶ 三视图
```

All four nodes go into one group `角色 · 林夏`.

## Common mistakes

| 错误 | 后果 | 正确做法 |
| --- | --- | --- |
| 每个视图重写一遍描述 | 发型/衣服漂移 | 逐字复制同一段 identity |
| 三视图里写"不同角度" | 模型画出三张不同的人 | 明确"同一人物，正面/侧面/背面" |
| 背景写"室内" | 裁切后不可用 | 纯灰背景、无阴影 |
| 表情与身份写在同一段 | 表情表角色不像本人 | identity 固定在锚点，表情只改表情词 |
