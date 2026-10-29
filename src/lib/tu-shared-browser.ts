/** Compatibility shim for `@tu/shared/browser` imports from the tu_api canvas port. */

export {
  CANVAS_GRAPH_LIMITS,
  CANVAS_GRAPH_SCHEMA_VERSION,
  CanvasGraphValidationError,
  canvasEdgeRoles,
  canvasNodeOutputType,
  canvasNodeRunStatuses,
  canvasNodeTypes,
  collectCanvasAssetIds,
  createEmptyCanvasGraph,
  parseCanvasGraph,
  sortCanvasNodes,
  validateCanvasGraph,
} from "@/lib/canvas/canvas-graph";

export type {
  CanvasEdgeRole,
  CanvasGenerationDefaults,
  CanvasGraph,
  CanvasGraphEdge,
  CanvasGraphNode,
  CanvasMediaReference,
  CanvasNodeData,
  CanvasNodeRunStatus,
  CanvasNodeType,
  CanvasSettings,
} from "@/lib/canvas/canvas-graph";

export {
  CANVAS_RUN_CONCURRENCY,
  buildCanvasRunPlan,
} from "@/lib/canvas/canvas-run-plan";

export type {
  CanvasRunMode,
  CanvasRunNodeStatus,
  CanvasRunPlan,
  CanvasRunResult,
} from "@/lib/canvas/canvas-run-plan";

export {
  canvasRunJobName,
  canvasRunQueueName,
} from "@/lib/canvas/canvas-run-queue";

export type { CanvasRunJobData } from "@/lib/canvas/canvas-run-queue";

export {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_SYMBOL,
  currencyCodeFromSymbol,
  currencyPresetFromSymbol,
  currencySymbolFromPreset,
  currencySymbolPresets,
  normalizeCurrencySymbol,
} from "@/lib/shared/currency";

export type { CurrencySymbolPreset } from "@/lib/shared/currency";

export {
  buildAssetDisplayName,
} from "@/lib/shared/asset-library";

export type { AssetPurpose } from "@/lib/shared/asset-library";

export {
  imageWaitTimeoutMs,
  resolveVideoWaitTimeoutMs,
  videoTimeoutMaxMs,
} from "@/lib/shared/gateway";

export {
  modelVendorIds,
  parseVideoPriceTable,
  videoResolutions,
} from "@/lib/shared/video-pricing";

export type {
  ModelVendorId,
  VideoPriceTable,
  VideoResolution,
} from "@/lib/shared/video-pricing";

export {
  PLAYGROUND_BEARER_PREFIX,
  PLAYGROUND_BEARER_REDIS_PREFIX,
  playgroundBearerRedisKey,
} from "@/lib/shared/playground-bearer";

export { adapterKeys, isAdapterKey } from "@/lib/shared/adapter-keys";
export type { AdapterKey } from "@/lib/shared/adapter-keys";
