# 画布 store 设计：如何避免重渲染

本文是画布状态层的约定。改画布相关代码前先读一遍；`src/lib/canvas/canvas-store-contract.test.ts` 用测试锁住了下面的不变量（`pnpm test`）。

## 1. 状态分层

不要把所有东西塞进一个 store。每个 store 只负责一件事，写入频率不同的东西绝不混在一起：

| store | 内容 | 谁在写 | 通知范围 |
|---|---|---|---|
| `canvas-store` | `nodes` / `edges` / `settings`（**只有文档数据**） | 图变更、节点数据、尺寸、选中 | 画布相关消费者 |
| `canvas-transient-store` | `dragOverGroupId` / `snapTargetId` / `uploadProgressById` | 指针手势、上传进度 | 只有读这几个字段的组件 |
| `canvas-interaction-store` | `draggingNode` / `draggingNodeIds` | 手势开始/结束 | 标签层、面板、边动画 |
| `canvas-helper-lines-store` | 对齐参考线 | 拖拽帧（值不变不写） | 只有参考线 overlay |
| `canvas-run-status-store` | 每节点运行状态 | 轮询（批量写） | 节点状态/工具栏计数 |
| `canvas-viewport-perf-store` | 视口 + 可见节点集合 | 手势结束（防抖） | 需要可见集的消费者 |
| `canvas-viewport-motion-store` | `moving` | 手势开始/结束 | 画布表层 CSS 钩子 |

为什么拆：一个 store 的一次 `set` 会跑**所有**订阅者的 selector。把上传进度放在图 store 里，会让「上传 1% 一次」唤醒所有节点/标签/边的 selector。

## 2. 读取规则

1. **只有 `CanvasFlowSurface` 可以订阅 `nodes` / `edges` 数组。** 它持有 React Flow 的显示缓冲。其他任何组件订阅数组都会在拖拽/编辑时每帧重渲染。
2. 其它组件一律用 `src/lib/canvas/canvas-selectors.ts` 里的 hook：
   - `useCanvasNode(id)`、`useCanvasNodeCount()`、`useCanvasEdgeCount()`
   - `useCanvasSelection()`、`useSelectedIdKey()`、`useSelectedCount()`、`useGroupableSelectionCount()`
   - `useCanvasMediaCounts()`、`useLabelEntries()`、`useMentionEntries()`、`useCanvasRunningTaskCount()`
   - 瞬时状态：`useCanvasSnapTarget` / `useCanvasUploadProgress` / `useCanvasIsUploading` / `useCanvasDragOverGroup`
3. 回调里要「读最新状态」时用 `useCanvasStore.getState()`（或对应 store 的 `getState()`），不要为了回调去订阅。
4. 动作（`updateNodeData`、`selectNode`…）可以直接 `useCanvasStore(s => s.action)`，zustand 的动作引用永远稳定。

## 3. 派生数据必须缓存

`canvas-derived.ts` 用 `WeakMap` 按**数组身份**缓存派生视图（选中集、子节点索引、标签快照、媒体计数、@ 提及列表）。第一次 O(n)，之后 O(1)，并且返回值身份稳定，`useShallow` 才能在「值没变」时跳过渲染。

需要新增派生视图时：在 `canvas-derived.ts` 里加一个 `WeakMap<数组, 结果>` 缓存 + 在 `canvas-selectors.ts` 里加 hook，不要在组件里写 `state.nodes.filter(...)`。

## 4. 写入规则

1. **值没变就不要写。** store 的写操作内部都做了 no-op 短路（`updateNodeData`、`setNodeSize`、`setNodePosition`、`selectNode`、`setSettings`、`replace`、`setNodes`、瞬时 store 的三个 setter）。新增写操作时照做。
2. **一次交互只写一次。** 拖拽期间改本地显示缓冲（`canvas-flow-surface.tsx`），松手才 `setNodes` 一次；批量状态更新用 `patchManyNodeData` / `useCanvasRunStatusStore.patchMany`。
3. **只换变化的节点对象**（`{...node, data}`），其它节点保持引用——React Flow 用身份比较跳过未变节点。
4. 不要把 UI 状态写进图 store（见第 1 节的分层表）。

## 5. 渲染侧的约定

- **LOD 用 CSS 类，不要用 React 分支**：`.canvas-far` / `.canvas-overview` / `[data-zooming]` 由 `storeApi.subscribe` 命令式切换（`canvas-flow-surface.tsx`），跨阈值不重渲染任何节点。
- **视口相关的值不要用 `useViewport()`**：背景、小地图、缩放标签、节点 dock 位置都用 `storeApi.subscribe` + 直接写 DOM 属性。
- **句柄必须始终有布局盒**：xyflow 靠测量句柄定位连线，`display: none` 会让连线塌缩到一点。远景/缩放期间用 `visibility: hidden`。
- **边线用 `vector-effect: non-scaling-stroke`**，否则缩放到 10% 时 1.5px 描边只剩 0.15px，看起来「连线没了」。

## 6. 防止回归

```bash
pnpm test          # 契约测试：写操作只换变化的节点 / no-op 不写 / 瞬时状态不碰图 / 派生缓存 / 显示缓冲身份
```

新增组件时自查三件事：

1. 它订阅了吗？订阅的东西多久变一次？
2. 变一次会让多少组件重渲染？（DevTools Profiler → Highlight updates，平移/缩放应该**没有任何高亮**）
3. 有没有用 `useCanvasStore.getState()` 就能满足的读取被写成了订阅？
