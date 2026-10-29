import { isAdapterKey, type AdapterKey } from "./adapter-keys";

export const providerTemplateKeys = [
  "ark",
  "jimeng",
  "openai-compat",
  "clmm-mall",
  "gemini",
  "tokenmarket-seedream",
  "tokenmarket-seedance",
  "tokenmarket-seedance-max",
  "tokenmarket-adapter-doubao",
  "tokenmarket-minimax",
  "minimax",
  "tokenmarket-image",
  "tokenmarket-adapter",
  "custom",
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

export type ProviderTemplateKey = (typeof providerTemplateKeys)[number];

export type ProviderConfigSchema = {
  type: "object";
  required: string[];
  properties: Record<string, { type: "string" }>;
};

export type ProviderTemplate = {
  key: ProviderTemplateKey;
  name: string;
  adapterKey: AdapterKey | null;
  defaultBaseUrl: string;
  configSchema: ProviderConfigSchema;
};

export const providerTemplates: ProviderTemplate[] = [
  {
    key: "ark",
    name: "火山方舟",
    adapterKey: "ark",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "jimeng",
    name: "即梦 Visual",
    adapterKey: "jimeng",
    defaultBaseUrl: "https://visual.volcengineapi.com",
    configSchema: {
      type: "object",
      required: ["accessKey", "secretKey"],
      properties: {
        accessKey: { type: "string" },
        secretKey: { type: "string" },
      },
    },
  },
  {
    key: "openai-compat",
    name: "OpenAI 兼容",
    adapterKey: "openai-compat",
    defaultBaseUrl: "https://api.openai.com/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "clmm-mall",
    name: "陆以锦(clmm-mall.top)",
    adapterKey: "clmm-mall",
    defaultBaseUrl: "https://clmm-mall.top/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "gemini",
    name: "Gemini / Imagen / Banana",
    adapterKey: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-seedream",
    name: "(tokenmarket)seedream",
    adapterKey: "tokenmarket-seedream",
    // 文档中图片生成 BASE_URL：https://model.service-inference.ai
    // 其中生成接口为 /v1/images/generations，素材接口为 /api/assets/*
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-seedance",
    name: "(tokenmarket)seedance",
    adapterKey: "tokenmarket-seedance",
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-seedance-max",
    name: "(tokenmarket)seedance-max",
    adapterKey: "tokenmarket-seedance-max",
    // Dreamina SD Max：POST /v2/video/generate，GET /v2/video/tasks/{id}
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-adapter-doubao",
    name: "(tokenmarket)doubao-seedance-max",
    adapterKey: "tokenmarket-adapter-doubao",
    // doubao-sd-max：直接传 https URL，POST /v2/video/generate，GET /v2/video/tasks/{id}
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-minimax",
    name: "(tokenmarket)minimax-h3",
    adapterKey: "tokenmarket-minimax",
    // MiniMax H3 视频：POST /v1/video/generate，GET /v1/video/tasks/{id}
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "minimax",
    name: "MiniMax H3",
    adapterKey: "minimax",
    // 官方 V2：POST /v2/video_generation，GET /v2/query/video_generation/{id}
    defaultBaseUrl: "https://api.minimax.io",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-image",
    name: "(tokenmarket)gpt-image",
    adapterKey: "tokenmarket-image",
    // gpt-image-2：POST /v1/images/generations（OpenAI 风格，结果多为 b64_json）
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "tokenmarket-adapter",
    name: "(tokenmarket)openai",
    adapterKey: "tokenmarket-adapter",
    // 通用 OpenAI：chat + 官方 images/generations；有参考图走 images/edits（images[{image_url}]）；Gemini 系生图走 /v1beta generateContent
    defaultBaseUrl: "https://model.service-inference.ai",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "custom",
    name: "自定义",
    adapterKey: null,
    defaultBaseUrl: "",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "xg-adapter",
    name: "小郭(newapi.heihuafei.cn)",
    adapterKey: "xg-adapter",
    defaultBaseUrl: "https://newapi.heihuafu.cn",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "starFrame-adapter",
    name: "唐松(starframe-api)",
    adapterKey: "starFrame-adapter",
    defaultBaseUrl: "https://api.xzapi.vip",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "xz-adapter",
    name: "小智(521xxz.com)",
    adapterKey: "xz-adapter",
    defaultBaseUrl: "",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "xz-seedance-adapter",
    name: "小智Seedance(521xxz.com)",
    adapterKey: "xz-seedance-adapter",
    defaultBaseUrl: "",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "xz-seedance-2.5-adapter",
    name: "小智Seedance 2.5(521ai)",
    adapterKey: "xz-seedance-2.5-adapter",
    defaultBaseUrl: "",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "nukoai-adapter",
    name: "小龙(nukoai.com)",
    adapterKey: "nukoai-adapter",
    defaultBaseUrl: "https://www.nukoai.com/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "xh-adapter",
    name: "刘总[星核新](apisv.yld-education.com)",
    adapterKey: "xh-adapter",
    defaultBaseUrl: "https://apisv.yld-education.com/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "xinghe-adapter",
    name: "星核(api.shishikeji.com)",
    adapterKey: "xinghe-adapter",
    defaultBaseUrl: "https://api.shishikeji.com",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "sk-adapter",
    name: "SK 视频",
    adapterKey: "sk-adapter",
    defaultBaseUrl: "http://38.76.169.86:8080",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "jy-adapter",
    name: "九月渠道(pidoi.com)",
    adapterKey: "jy-adapter",
    defaultBaseUrl: "https://pidoi.com",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "ki-adapter",
    name: "筷子Seedance2.5(aigccc666.com)",
    adapterKey: "ki-adapter",
    defaultBaseUrl: "https://www.aigccc666.com",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "gate-adapter",
    name: "Gate(astralmindai.com)",
    adapterKey: "gate-adapter",
    defaultBaseUrl: "https://api-gate.astralmindai.com",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "jm-adapter",
    name: "即梦 CLI (jm.tokenmei.com)",
    adapterKey: "jm-adapter",
    // OpenAI-style /v1 surface; adapter normalizes baseUrl to end with /v1.
    defaultBaseUrl: "https://jm.tokenmei.com/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "lms-adapter",
    name: "LMS Seedance 2.0 (meaicc.com)",
    adapterKey: "lms-adapter",
    // OpenAI-style /v1 surface; adapter normalizes baseUrl to end with /v1.
    defaultBaseUrl: "https://api.meaicc.com/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "fly-adapter",
    name: "FLY API (flyapi.vip)",
    adapterKey: "fly-adapter",
    defaultBaseUrl: "https://flyapi.vip",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "global-adapter",
    name: "GlobalAIOPC (zcbservice.aizfw.cn)",
    adapterKey: "global-adapter",
    defaultBaseUrl: "https://zcbservice.aizfw.cn/kyyReactApiServer",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "yihong-adapter",
    name: "易红 API (yihongapi.com)",
    adapterKey: "yihong-adapter",
    defaultBaseUrl: "https://yihongapi.com",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "weijin-adapter",
    name: "微金 API (weijinapi.top)",
    adapterKey: "weijin-adapter",
    defaultBaseUrl: "https://www.weijinapi.top",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "jimengvip-adapter",
    name: "新梦AI (jimengvip.online)",
    adapterKey: "jimengvip-adapter",
    // 文档要求必须使用 www；无 www 会被 308 重定向并可能丢失 Authorization。
    defaultBaseUrl: "https://www.jimengvip.online/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "968api-adapter",
    name: "968API (ap.968968968.xyz)",
    adapterKey: "968api-adapter",
    // 图片 / 视频分组各用一个 Key；Base URL 已含 /v1。
    defaultBaseUrl: "https://ap.968968968.xyz/v1",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
  {
    key: "trx-adapter",
    name: "TRX 视频 (trxdoc.xin)",
    adapterKey: "trx-adapter",
    // 原生视频接口，Base URL 不带 /v1（Adapter 会补齐）。
    defaultBaseUrl: "https://trxdoc.xin",
    configSchema: {
      type: "object",
      required: ["apiKey"],
      properties: {
        apiKey: { type: "string" },
      },
    },
  },
];

export function findProviderTemplate(
  key: string,
): ProviderTemplate | undefined {
  return providerTemplates.find((template) => template.key === key);
}

export function getTemplateByAdapterKey(
  adapterKey: AdapterKey,
): ProviderTemplate | undefined {
  return providerTemplates.find(
    (template) => template.adapterKey === adapterKey,
  );
}

export function inferTemplateKeyFromAdapter(
  adapterKey: string,
): ProviderTemplateKey {
  if (!isAdapterKey(adapterKey)) {
    return "custom";
  }
  return getTemplateByAdapterKey(adapterKey)?.key ?? "custom";
}

export { isAdapterKey };
export type { AdapterKey };
