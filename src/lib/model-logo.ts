/**
 * Resolve `/public/logo/{theme}/{name}.svg` for a model by matching
 * display name / owned_by / id against known logo stems and aliases.
 */

export const MODEL_LOGO_STEMS = [
  "Antigravity",
  "Apple Intelligent",
  "ChatGPT",
  "Claude",
  "Codex",
  "Cohere",
  "DeepSeek",
  "Fireworks AI",
  "Gemini",
  "nanobanana",
  "Grok",
  "Hugging Face",
  "Kimi",
  "Microsoft Copilot",
  "Mid Journey",
  "MiniMax",
  "Mistral AI",
  "Notion",
  "Poe",
  "Qwen",
  "azure",
  "bigmodel",
  "bytedance",
  "seedance",
  "happyhorse",
  "kling",
  "manus",
  "meta",
  "ollama",
  "perplexity",
  "runway",
  "sora",
  "stability.ai",
  "suno",
] as const;

export type ModelLogoStem = (typeof MODEL_LOGO_STEMS)[number];
export type ModelLogoTheme = "light" | "dark";

/** Extra keywords → logo stem (normalized match against model id / name). */
const MODEL_LOGO_ALIASES: Record<string, ModelLogoStem> = {
  gpt: "ChatGPT",
  chatgpt: "ChatGPT",
  openai: "ChatGPT",
  o1: "ChatGPT",
  o3: "ChatGPT",
  o4: "ChatGPT",
  claude: "Claude",
  anthropic: "Claude",
  gemini: "Gemini",
  google: "Gemini",
  bard: "Gemini",
  // Banana / nano-banana 产品 logo；厂商可仍为 Gemini
  banana: "nanobanana",
  nanobanana: "nanobanana",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  tongyi: "Qwen",
  alibaba: "Qwen",
  // 通义万相 Wan / Wanx / Wan2 / Wan3 → 通义千问 logo
  wan: "Qwen",
  wan2: "Qwen",
  wan3: "Qwen",
  wanx: "Qwen",
  wanxiang: "Qwen",
  kimi: "Kimi",
  moonshot: "Kimi",
  grok: "Grok",
  xai: "Grok",
  mistral: "Mistral AI",
  llama: "meta",
  meta: "meta",
  midjourney: "Mid Journey",
  "mid-journey": "Mid Journey",
  mj: "Mid Journey",
  runway: "runway",
  kling: "kling",
  sora: "sora",
  minimax: "MiniMax",
  hailuo: "MiniMax",
  bytedance: "bytedance",
  // Seedance 产品 logo；厂商仍是 bytedance
  seedance: "seedance",
  seeddance: "seedance",
  seedream: "bytedance",
  doubao: "bytedance",
  glm: "bigmodel",
  zhipu: "bigmodel",
  bigmodel: "bigmodel",
  chatglm: "bigmodel",
  suno: "suno",
  cohere: "Cohere",
  command: "Cohere",
  perplexity: "perplexity",
  sonar: "perplexity",
  fireworks: "Fireworks AI",
  azure: "azure",
  ollama: "ollama",
  stability: "stability.ai",
  stable: "stability.ai",
  sd: "stability.ai",
  huggingface: "Hugging Face",
  "hugging-face": "Hugging Face",
  hf: "Hugging Face",
  poe: "Poe",
  notion: "Notion",
  manus: "manus",
  codex: "Codex",
  apple: "Apple Intelligent",
  copilot: "Microsoft Copilot",
  microsoft: "Microsoft Copilot",
  happyhorse: "happyhorse",
  antigravity: "Antigravity",
};

function normalizeLogoKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const STEM_BY_NORMALIZED = new Map(
  MODEL_LOGO_STEMS.map((stem) => [normalizeLogoKey(stem), stem] as const),
);

/** Product logos that should beat foundation-vendor logos when both match. */
function productLogoBonus(stem: ModelLogoStem): number {
  return stem === "seedance" || stem === "nanobanana" ? 250 : 0;
}

function collectCandidates(parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const trimmed = part.trim();
    if (!trimmed) continue;
    out.push(trimmed);
    for (const token of trimmed.split(/[/_\s.-]+/)) {
      if (token) out.push(token);
    }
  }
  return out;
}

/**
 * Pick the best logo stem for a model. Prefers longer / more specific matches.
 */
export function resolveModelLogoStem(
  ...parts: Array<string | null | undefined>
): ModelLogoStem | null {
  const candidates = collectCandidates(parts);
  if (candidates.length === 0) {
    return null;
  }

  let bestStem: ModelLogoStem | null = null;
  let bestScore = -1;

  function consider(stem: ModelLogoStem, score: number) {
    if (score > bestScore) {
      bestStem = stem;
      bestScore = score;
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeLogoKey(candidate);
    if (!normalized) continue;

    const exactStem = STEM_BY_NORMALIZED.get(normalized);
    if (exactStem) {
      consider(exactStem, 1000 + normalized.length);
    }

    const alias = MODEL_LOGO_ALIASES[normalized];
    if (alias) {
      consider(alias, 900 + normalized.length + productLogoBonus(alias));
    }

    for (const stem of MODEL_LOGO_STEMS) {
      const stemKey = normalizeLogoKey(stem);
      if (stemKey.length < 4) {
        continue;
      }
      // Only model-id contains stem (not the reverse) to avoid
      // "model" matching "bigmodel", etc.
      if (normalized.includes(stemKey)) {
        consider(stem, 500 + stemKey.length + productLogoBonus(stem));
      }
    }

    for (const [aliasKey, stem] of Object.entries(MODEL_LOGO_ALIASES)) {
      if (normalized === aliasKey) {
        consider(stem, 900 + aliasKey.length + productLogoBonus(stem));
        continue;
      }
      if (aliasKey.length >= 4 && normalized.includes(aliasKey)) {
        consider(stem, 400 + aliasKey.length + productLogoBonus(stem));
      }
    }

    // wan*（万相）前缀：token / 整串以 wan + 数字或 x 开头
    if (/^wan(?:\d|x)/.test(normalized)) {
      consider("Qwen", 850);
    }
    // banana* / Banana-* → nanobanana
    if (/^nano?banana/.test(normalized) || /^banana/.test(normalized)) {
      consider("nanobanana", 1150);
    }
  }

  return bestStem;
}

export function modelLogoSrc(
  stem: ModelLogoStem | string,
  theme: ModelLogoTheme,
): string {
  const key = normalizeLogoKey(stem);
  // Legacy seeddance → seedance; other aliases keep vendor/product mapping.
  const canonical =
    MODEL_LOGO_ALIASES[key] ??
    (STEM_BY_NORMALIZED.get(key) as ModelLogoStem | undefined) ??
    stem;
  return `/logo/${theme}/${encodeURIComponent(canonical)}.svg`;
}
