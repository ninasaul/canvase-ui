export const adapterKeys = [
  "openai-compat",
  "openai-video-compat",
  "gemini",
  "clmm-mall",
  "ark",
  "jimeng",
  "tokenmarket-seedream",
  "tokenmarket-seedance",
  "tokenmarket-seedance-max",
  "tokenmarket-adapter-doubao",
  "tokenmarket-minimax",
  "minimax",
  "tokenmarket-image",
  "tokenmarket-adapter",
  "xg-adapter",
  "starFrame-adapter",
  "xz-adapter",
  "xz-seedance-adapter",
  "xz-seedance-2.5-adapter",
  "nukoai-adapter",
  "xh-adapter",
  "xinghe-adapter",
  "sk-adapter",
  "jy-adapter",
  "ki-adapter",
  "gate-adapter",
  "jm-adapter",
  "lms-adapter",
  "fly-adapter",
  "global-adapter",
  "yihong-adapter",
  "weijin-adapter",
  "jimengvip-adapter",
  "968api-adapter",
  "trx-adapter",
] as const;

export type AdapterKey = (typeof adapterKeys)[number];

export function isAdapterKey(value: string): value is AdapterKey {
  return (adapterKeys as readonly string[]).includes(value);
}
